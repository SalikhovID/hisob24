package warehouse

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
)

// The order's document (logic/orders.md, 4.3): an order's price, its lines
// of goods (the products out of the stock) and the payments entered for
// it, kept as one document of the journal of the kind order
// (ledger.Order). The order service writes it inside its own transaction,
// under the company's lock, so the functions here take the queries of
// that transaction.

// OrderHead is the order a document is of: the order, its customer and
// its location.
type OrderHead struct {
	ID         int64
	CustomerID int64
	LocationID int64
}

// OrderMoneyInput is an order's money as the client sent it: the price in
// a currency by a rate, the lines of goods, the advance (on entry alone).
type OrderMoneyInput struct {
	Amount     *string
	CurrencyID *int64
	Rate       *string
	Items      []ItemInput
	Payments   []ledger.PaymentLine
}

// OrderLine is a line of an order: a product (out of the stock) or a
// service, and its quantity.
type OrderLine struct {
	ProductID int64
	Name      string
	Kind      string
	Unit      *string
	Quantity  string
}

// OrderPayment is a payment entered for an order: into an account, in the
// account's currency, by the payment's rate; what it comes to in so'm.
type OrderPayment struct {
	ID            int64
	BankAccountID int64
	AccountName   string
	Amount        string
	CurrencyID    int64
	Rate          string
	AmountUZS     string
	At            time.Time
	Note          *string
	CreatedByName *string
}

// OrderMoney is an order's money as the API shows it: the document (0 for
// none), the price in its currency by its rate and in so'm, what was paid
// for the order in its currency, the lines and the payments.
type OrderMoney struct {
	DocumentID int64
	Amount     string
	CurrencyID int64
	Rate       string
	AmountUZS  string
	Paid       string
	Items      []OrderLine
	Payments   []OrderPayment
}

// noMoney is what an order without a document shows: nothing, in so'm.
func noMoney() OrderMoney {
	return OrderMoney{Amount: "0.00", CurrencyID: currency.UZS, Rate: "1.0000", AmountUZS: "0.00", Paid: "0.00", Items: []OrderLine{}, Payments: []OrderPayment{}}
}

// orderAmount reads an order's price: none, or money not below zero
// ("Narx noto'g'ri").
func orderAmount(raw *string) (pgtype.Numeric, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return zero(), nil
	}
	n, err := catalog.Money(raw, "Narx noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	return n, nil
}

// checkedOrderMoney is an input as it is kept.
type checkedOrderMoney struct {
	Amount  pgtype.Numeric
	Pricing ledger.Pricing
	Items   []checkedItem
}

// checkOrderMoney reads the money against the company, inside the write,
// as the member with phone by, for the document's moment at. What is wrong
// is told in this order (logic/orders.md, 4.1): the price, the currency
// and the rate (current: the document's pricing now), the lines (none is
// fine; a product or a service, once, with a quantity, without a price).
func checkOrderMoney(ctx context.Context, q *gen.Queries, companyID int64, by string, in OrderMoneyInput, at time.Time, held map[int64]bool, current *ledger.Pricing) (checkedOrderMoney, error) {
	var c checkedOrderMoney
	var err error
	if c.Amount, err = orderAmount(in.Amount); err != nil {
		return c, err
	}
	if c.Pricing, err = ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{CurrencyID: in.CurrencyID, Rate: in.Rate}, at, by, current); err != nil {
		return c, err
	}
	if c.Items, err = checkLines(ctx, q, companyID, in.Items, held, lineRule{AllowNone: true, AllowService: true}); err != nil {
		return c, err
	}
	return c, nil
}

func toOrderLines(rows []gen.ListTransactionItemsRow) []OrderLine {
	lines := make([]OrderLine, 0, len(rows))
	for _, r := range rows {
		lines = append(lines, OrderLine{ProductID: r.ProductID, Name: r.Name, Kind: r.Kind, Unit: r.Unit, Quantity: quantity(r.Quantity)})
	}
	return lines
}

func toOrderPayment(r gen.ListOrderPaymentsRow) OrderPayment {
	return OrderPayment{
		ID: r.ID, BankAccountID: r.BankAccountID, AccountName: r.AccountName, Amount: amount(r.Amount), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate),
		AmountUZS: amount(r.AmountUzs), At: r.DocAt.UTC(), Note: r.Note, CreatedByName: r.CreatedByName,
	}
}

// ReadOrderMoney reads the order's money from its live document: nothing
// without one.
func ReadOrderMoney(ctx context.Context, q *gen.Queries, companyID, orderID int64) (OrderMoney, error) {
	d, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: orderID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return noMoney(), nil
	}
	if err != nil {
		return OrderMoney{}, err
	}
	rows, err := q.ListTransactionItems(ctx, d.ID)
	if err != nil {
		return OrderMoney{}, err
	}
	payments, err := q.ListOrderPayments(ctx, d.ID)
	if err != nil {
		return OrderMoney{}, err
	}
	m := OrderMoney{
		DocumentID: d.ID, Amount: amount(d.Total), CurrencyID: d.CurrencyID, Rate: currency.RateText(d.Rate), AmountUZS: amount(d.TotalUzs), Paid: amount(d.Paid),
		Items: toOrderLines(rows), Payments: make([]OrderPayment, 0, len(payments)),
	}
	for _, p := range payments {
		m.Payments = append(m.Payments, toOrderPayment(p))
	}
	return m, nil
}

// WriteOrderDocument saves the order's money, as the member with phone by
// (and name), inside the order's write (logic/orders.md, 4.3). The
// document is written when there is something to write (a price, a line,
// an advance with withPayments) or it is there already: entered with the
// order's customer and location at this moment, or saved anew with its
// moment and number kept. Its price and lines are replaced, its moves
// written anew, the advance's payments entered (withPayments: on entry
// alone; an edit leaves the payments alone), then the stock of the
// products of the old and the new lines is checked (409). Nothing is
// written after a refusal.
func WriteOrderDocument(ctx context.Context, q *gen.Queries, companyID int64, by string, name *string, order OrderHead, in OrderMoneyInput, withPayments bool) (OrderMoney, error) {
	amount, err := orderAmount(in.Amount)
	if err != nil {
		return OrderMoney{}, err
	}
	existing, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: order.ID, CompanyID: companyID})
	exists := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return OrderMoney{}, err
	}
	if !exists && catalog.Zero(amount) && len(in.Items) == 0 && (!withPayments || len(in.Payments) == 0) {
		return noMoney(), nil
	}
	at := time.Now()
	var held map[int64]bool
	var current *ledger.Pricing
	var old []gen.ListTransactionItemsRow
	if exists {
		at = existing.DocAt
		current = &ledger.Pricing{CurrencyID: existing.CurrencyID, RateID: existing.CurrencyRateID, Rate: existing.Rate}
		if old, err = q.ListTransactionItems(ctx, existing.ID); err != nil {
			return OrderMoney{}, err
		}
		held = heldOf(old)
	}
	c, err := checkOrderMoney(ctx, q, companyID, by, in, at, held, current)
	if err != nil {
		return OrderMoney{}, err
	}
	documentID := existing.ID
	if exists {
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: existing.ID, CompanyID: companyID, DocAt: at, CustomerID: &order.CustomerID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: existing.Note,
		}); err != nil {
			return OrderMoney{}, err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: existing.ID, Total: c.Amount}); err != nil {
			return OrderMoney{}, err
		}
	} else {
		number, err := ledger.NextNumber(ctx, q, companyID, ledger.Order)
		if err != nil {
			return OrderMoney{}, err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: companyID, Kind: string(ledger.Order), Number: number, DocAt: at, LocationID: &order.LocationID, CustomerID: &order.CustomerID, OrderID: &order.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return OrderMoney{}, err
		}
		documentID = row.ID
	}
	if err := writeGoodsLines(ctx, q, documentID, c.Items); err != nil {
		return OrderMoney{}, err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, documentID, ledger.MovesOf(ledger.Order, order.LocationID, 0, linesOf(c.Items))); err != nil {
		return OrderMoney{}, err
	}
	if withPayments {
		head := ledger.Head{ID: documentID, Kind: ledger.Order, CompanyID: companyID, CustomerID: &order.CustomerID, At: at}
		if err := ledger.WriteLinkedPayments(ctx, q, head, in.Payments, by, name); err != nil {
			return OrderMoney{}, err
		}
	}
	if err := ledger.CheckStock(ctx, q, []int64{order.LocationID}, append(productsOf(c.Items), productsOfRows(old)...)); err != nil {
		return OrderMoney{}, err
	}
	return ReadOrderMoney(ctx, q, companyID, order.ID)
}

// DeleteOrderDocument hides the order's document, gives its products back
// to the stock and hides the payments linked to it; an order without one
// has nothing to delete.
func DeleteOrderDocument(ctx context.Context, q *gen.Queries, companyID, orderID int64) error {
	d, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: orderID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: d.ID, CompanyID: companyID}); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, d.ID, nil); err != nil {
		return err
	}
	return q.HideLinkedPayments(ctx, d.ID)
}

// PriceText is the price as the history writes it ("5 000 $", "1 200 000
// so'm"), "" for none.
func (m OrderMoney) PriceText() string {
	if m.Amount == "" || strings.Trim(m.Amount, "0.") == "" {
		return ""
	}
	return numtext.Grouped(m.Amount) + " " + currency.SymbolOf(m.CurrencyID)
}

// LinesText is the lines as the history writes them ("Kabel × 2 m, Montaj
// × 1"), "" for none.
func (m OrderMoney) LinesText() string {
	parts := make([]string, 0, len(m.Items))
	for _, l := range m.Items {
		part := l.Name + " × " + numtext.Grouped(l.Quantity)
		if l.Unit != nil {
			part += " " + *l.Unit
		}
		parts = append(parts, part)
	}
	return strings.Join(parts, ", ")
}

// errOrderNotFound: the order is not one of the scope's.
var errOrderNotFound = apperr.New(apperr.NotFound, "not_found", "Buyurtma topilmadi")

// orderHeadOf is the live order in the scope's locations; one outside them
// is not found.
func orderHeadOf(ctx context.Context, q *gen.Queries, scope Scope, orderID int64) (OrderHead, error) {
	row, err := q.GetOrder(ctx, gen.GetOrderParams{ID: orderID, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return OrderHead{}, errOrderNotFound
	}
	if err != nil {
		return OrderHead{}, err
	}
	return OrderHead{ID: row.ID, CustomerID: row.CustomerID, LocationID: row.LocationID}, nil
}

// ensureOrderDocument is the order's live document, made now (priced at
// nothing, in so'm) when the order has none yet: a payment has to link to
// one.
func ensureOrderDocument(ctx context.Context, q *gen.Queries, companyID int64, by string, name *string, order OrderHead) (int64, error) {
	d, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: order.ID, CompanyID: companyID})
	if err == nil {
		return d.ID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	at := time.Now()
	pricing, err := ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{}, at, by, nil)
	if err != nil {
		return 0, err
	}
	number, err := ledger.NextNumber(ctx, q, companyID, ledger.Order)
	if err != nil {
		return 0, err
	}
	row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
		CompanyID: companyID, Kind: string(ledger.Order), Number: number, DocAt: at, LocationID: &order.LocationID, CustomerID: &order.CustomerID, OrderID: &order.ID,
		CurrencyID: pricing.CurrencyID, CurrencyRateID: pricing.RateID, Total: zero(), CreatedBy: by, CreatedByName: name,
	})
	if err != nil {
		return 0, err
	}
	return row.ID, nil
}

func getOrderPayment(ctx context.Context, q *gen.Queries, documentID, id int64) (OrderPayment, error) {
	r, err := q.GetOrderPayment(ctx, gen.GetOrderPaymentParams{ID: id, LinkedID: documentID})
	if errors.Is(err, pgx.ErrNoRows) {
		return OrderPayment{}, errPaymentNotFound
	}
	if err != nil {
		return OrderPayment{}, err
	}
	return toOrderPayment(gen.ListOrderPaymentsRow(r)), nil
}

// AddOrderPayment enters a payment for the order (one of the scope's) on
// its own, as the member with phone by (logic/orders.md, 4.3): the
// customer's payment at its own moment, linked to the order's document,
// made for it when the order has none. The order comes first (404), then
// what is wrong with the payment, in the order of checkPayment.
func (s *Service) AddOrderPayment(ctx context.Context, scope Scope, by string, orderID int64, in PaymentInput) (OrderPayment, error) {
	var p OrderPayment
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		order, err := orderHeadOf(ctx, q, scope, orderID)
		if err != nil {
			return err
		}
		c, err := checkPayment(ctx, q, scope.CompanyID, by, in, 0, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		documentID, err := ensureOrderDocument(ctx, q, scope.CompanyID, by, name, order)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.CustomerPayment)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.CustomerPayment), Number: number, DocAt: c.At, CustomerID: &order.CustomerID, BankAccountID: &c.Account.ID,
			LinkedID: &documentID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: c.Amount, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		p, err = getOrderPayment(ctx, q, documentID, row.ID)
		return err
	})
	return p, err
}

// orderPaymentOf is the order's document and the payment linked to it: the
// order comes first (404), then the payment (404 "To'lov topilmadi"; an
// order with no document has none).
func orderPaymentOf(ctx context.Context, q *gen.Queries, scope Scope, orderID, paymentID int64) (int64, OrderPayment, error) {
	order, err := orderHeadOf(ctx, q, scope, orderID)
	if err != nil {
		return 0, OrderPayment{}, err
	}
	d, err := q.GetOrderDocument(ctx, gen.GetOrderDocumentParams{OrderID: order.ID, CompanyID: scope.CompanyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, OrderPayment{}, errPaymentNotFound
	}
	if err != nil {
		return 0, OrderPayment{}, err
	}
	was, err := getOrderPayment(ctx, q, d.ID, paymentID)
	return d.ID, was, err
}

// UpdateOrderPayment saves a payment entered for the order with other
// fields, as the member with phone by. The account it already names is
// kept even when inactive.
func (s *Service) UpdateOrderPayment(ctx context.Context, scope Scope, by string, orderID, paymentID int64, in PaymentInput) (OrderPayment, error) {
	var p OrderPayment
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		documentID, was, err := orderPaymentOf(ctx, q, scope, orderID, paymentID)
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: paymentID, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkPayment(ctx, q, scope.CompanyID, by, in, was.BankAccountID, &current)
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: paymentID, CompanyID: scope.CompanyID, DocAt: c.At, CustomerID: head.CustomerID, BankAccountID: &c.Account.ID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := q.SetTransactionAmount(ctx, gen.SetTransactionAmountParams{ID: paymentID, Total: c.Amount}); err != nil {
			return err
		}
		p, err = getOrderPayment(ctx, q, documentID, paymentID)
		return err
	})
	return p, err
}

// DeleteOrderPayment hides a payment entered for the order.
func (s *Service) DeleteOrderPayment(ctx context.Context, scope Scope, orderID, paymentID int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		if _, _, err := orderPaymentOf(ctx, q, scope, orderID, paymentID); err != nil {
			return err
		}
		_, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: paymentID, CompanyID: scope.CompanyID})
		return err
	})
}
