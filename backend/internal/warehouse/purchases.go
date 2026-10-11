package warehouse

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// Purchase is a purchase as the API shows it: its head, its currency and
// rate, what it comes to (in its currency and in so'm), what was paid with
// it, and (on its own page) its lines and the payments entered with it.
type Purchase struct {
	ID           int64
	Number       int32
	LocationID   int64
	LocationName string
	SupplierID   int64
	SupplierName string
	At           time.Time
	CurrencyID   int64
	// Rate is the document's rate of its currency in so'm, four decimals
	// ("12800.0000"; "1.0000" for the so'm).
	Rate          string
	Note          *string
	Total         string
	TotalUZS      string
	Paid          string
	ItemsCount    int64
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	// Items are the lines, in the order entered; Payments the live payments
	// entered with the purchase. A list carries neither.
	Items    []Item
	Payments []LinkedPayment
}

// Item is a line of a purchase: a product, a quantity, a price and what the
// line comes to, in the purchase's currency.
type Item struct {
	ProductID int64
	Name      string
	Unit      *string
	Quantity  string
	Price     string
	Amount    string
}

// LinkedPayment is a payment entered with the purchase: out of an account,
// an amount in the account's currency.
type LinkedPayment struct {
	ID            int64
	BankAccountID int64
	AccountName   string
	Amount        string
	CurrencyID    int64
}

// ItemInput is a line as the client sent it.
type ItemInput struct {
	ProductID int64
	Quantity  *string
	Price     *string
}

// PurchaseInput is what a purchase is saved with, as the client sent it.
// The location is given apart, on entry alone.
type PurchaseInput struct {
	SupplierID int64
	At         string
	CurrencyID *int64
	Rate       *string
	Note       *string
	Items      []ItemInput
	Payments   []ledger.PaymentLine
}

// PurchaseListInput narrows the list: LocationID keeps one of the scope's
// locations (0: all of them), SupplierID one supplier (0: all). Page
// starts at 1.
type PurchaseListInput struct {
	LocationID int64
	SupplierID int64
	Page       int
}

// PurchasePage is one page of the purchases.
type PurchasePage struct {
	Items    []Purchase
	Total    int64
	Page     int
	PageSize int
}

// checkedItem is a line as it is kept.
type checkedItem struct {
	ProductID int64
	Quantity  pgtype.Numeric
	Price     pgtype.Numeric
}

// checkedPurchase is an input as it is kept.
type checkedPurchase struct {
	SupplierID int64
	At         time.Time
	Pricing    ledger.Pricing
	Note       *string
	Items      []checkedItem
}

// checkPurchase reads an input against the company, inside the write, as
// the member with phone by. What is wrong is told in this order
// (logic/warehouse.md, 4.2): the supplier (one of the company's; active
// unless it is the one the purchase already names, keep), the moment, the
// currency and the rate (current: the purchase's pricing now), the note,
// the lines (at least one; each product one of the company's, a product
// not a service, active unless the purchase already holds it (held), once;
// its quantity; its price). The payments are read as they are written.
func checkPurchase(ctx context.Context, q *gen.Queries, companyID int64, by string, in PurchaseInput, keep int64, held map[int64]bool, current *ledger.Pricing) (checkedPurchase, error) {
	c := checkedPurchase{SupplierID: in.SupplierID}
	if in.SupplierID == 0 {
		return c, invalid("Ta'minotchini tanlang")
	}
	active, err := q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: in.SupplierID, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return c, invalid("Ta'minotchini tanlang")
	}
	if err != nil {
		return c, err
	}
	if !active && in.SupplierID != keep {
		return c, invalid("Ta'minotchi nofaol")
	}
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Pricing, err = ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{CurrencyID: in.CurrencyID, Rate: in.Rate}, c.At, by, current); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	if len(in.Items) == 0 {
		return c, invalid("Kamida bitta mahsulot qo'shing")
	}
	seen := make(map[int64]bool, len(in.Items))
	for _, it := range in.Items {
		if it.ProductID == 0 {
			return c, invalid("Mahsulotni tanlang")
		}
		p, err := q.ProductStanding(ctx, gen.ProductStandingParams{ID: it.ProductID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return c, invalid("Mahsulotni tanlang")
		}
		if err != nil {
			return c, err
		}
		if p.Kind != catalog.KindProduct {
			return c, invalid("Xizmat xaridga kiritilmaydi")
		}
		if !p.IsActive && !held[it.ProductID] {
			return c, invalid("Mahsulot nofaol")
		}
		if seen[it.ProductID] {
			return c, invalid(fmt.Sprintf("«%s» ikki marta kiritilgan", p.Name))
		}
		seen[it.ProductID] = true
		quantity, err := catalog.Quantity(it.Quantity, fmt.Sprintf("«%s» miqdori noto'g'ri", p.Name))
		if err != nil {
			return c, err
		}
		badPrice := fmt.Sprintf("«%s» narxi noto'g'ri", p.Name)
		price, err := catalog.Money(it.Price, badPrice)
		if err != nil {
			return c, err
		}
		if !price.Valid {
			return c, invalid(badPrice)
		}
		c.Items = append(c.Items, checkedItem{ProductID: it.ProductID, Quantity: quantity, Price: price})
	}
	return c, nil
}

func toPurchase(r gen.GetPurchaseRow, items []Item, payments []LinkedPayment) Purchase {
	return Purchase{
		ID: r.ID, Number: r.Number, LocationID: r.LocationID, LocationName: r.LocationName, SupplierID: r.SupplierID, SupplierName: r.SupplierName,
		At: r.DocAt.UTC(), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate), Note: r.Note, Total: amount(r.Total), TotalUZS: amount(r.TotalUzs), Paid: amount(r.Paid),
		ItemsCount: r.ItemsCount, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt, Items: items, Payments: payments,
	}
}

func toItems(rows []gen.ListTransactionItemsRow) []Item {
	items := make([]Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, Item{ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Quantity: quantity(r.Quantity), Price: amount(r.Price), Amount: amount(r.Amount)})
	}
	return items
}

func toLinkedPayments(rows []gen.ListLinkedPaymentsRow) []LinkedPayment {
	payments := make([]LinkedPayment, 0, len(rows))
	for _, r := range rows {
		payments = append(payments, LinkedPayment{ID: r.ID, BankAccountID: r.BankAccountID, AccountName: r.AccountName, Amount: amount(r.Amount), CurrencyID: r.CurrencyID})
	}
	return payments
}

// getPurchase is the purchase with its lines and payments, in the scope's
// locations; one outside them is not found.
func getPurchase(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Purchase, error) {
	r, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return Purchase{}, errPurchaseNotFound
	}
	if err != nil {
		return Purchase{}, err
	}
	rows, err := q.ListTransactionItems(ctx, id)
	if err != nil {
		return Purchase{}, err
	}
	payments, err := q.ListLinkedPayments(ctx, id)
	if err != nil {
		return Purchase{}, err
	}
	return toPurchase(r, toItems(rows), toLinkedPayments(payments)), nil
}

// ListPurchases is a page of the purchases in the scope's locations, or in
// the one asked for (one outside the scope counts as none: the handler
// refuses it before), the newest first; SupplierID keeps one supplier's.
// The rows carry no lines.
func (s *Service) ListPurchases(ctx context.Context, scope Scope, in PurchaseListInput) (PurchasePage, error) {
	if err := pageOf(in.Page); err != nil {
		return PurchasePage{}, err
	}
	locations := scope.LocationIDs
	if in.LocationID != 0 {
		locations = []int64{}
		if scope.has(in.LocationID) {
			locations = []int64{in.LocationID}
		}
	}
	var supplier *int64
	if in.SupplierID != 0 {
		supplier = &in.SupplierID
	}
	total, err := s.q.CountPurchases(ctx, gen.CountPurchasesParams{CompanyID: scope.CompanyID, LocationIds: locations, SupplierID: supplier})
	if err != nil {
		return PurchasePage{}, err
	}
	rows, err := s.q.ListPurchases(ctx, gen.ListPurchasesParams{
		CompanyID: scope.CompanyID, LocationIds: locations, SupplierID: supplier, Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return PurchasePage{}, err
	}
	items := make([]Purchase, 0, len(rows))
	for _, r := range rows {
		items = append(items, toPurchase(gen.GetPurchaseRow(r), nil, nil))
	}
	return PurchasePage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetPurchase is a purchase in the scope's locations, with its lines and
// the payments entered with it.
func (s *Service) GetPurchase(ctx context.Context, scope Scope, id int64) (Purchase, error) {
	return getPurchase(ctx, s.q, scope, id)
}

// CreatePurchase enters a purchase into the location (one of the scope's),
// as the member with phone by: numbered next in the company, its lines
// into the location's stock at once, and what was paid as payments linked
// to it. All of it is written, or none.
func (s *Service) CreatePurchase(ctx context.Context, scope Scope, by string, locationID int64, in PurchaseInput) (Purchase, error) {
	// The location is one the member works in (the handler has refused
	// another with 403 already; here it is no location at all).
	if locationID == 0 || !scope.has(locationID) {
		return Purchase{}, errNoLocation
	}
	var p Purchase
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkPurchase(ctx, q, scope.CompanyID, by, in, 0, nil, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.Purchase)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.Purchase), Number: number, DocAt: c.At, LocationID: &locationID, SupplierID: &c.SupplierID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: zero(), Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeLines(ctx, q, scope.CompanyID, row.ID, locationID, c.Items); err != nil {
			return err
		}
		head := ledger.Head{ID: row.ID, Kind: ledger.Purchase, CompanyID: scope.CompanyID, SupplierID: &c.SupplierID, At: c.At}
		if err := ledger.WriteLinkedPayments(ctx, q, head, in.Payments, by, name); err != nil {
			return err
		}
		p, err = getPurchase(ctx, q, scope, row.ID)
		return err
	})
	return p, err
}

// UpdatePurchase saves the purchase with other fields, lines and payments,
// as the member with phone by. The number and the location stay; the lines
// and the moves are written anew; the payments entered with it are
// replaced by the ones sent; the supplier, the products and the accounts
// the purchase already names are kept even when inactive. The record
// itself comes first.
func (s *Service) UpdatePurchase(ctx context.Context, scope Scope, by string, id int64, in PurchaseInput) (Purchase, error) {
	var p Purchase
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getPurchase(ctx, q, scope, id)
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		held := make(map[int64]bool, len(was.Items))
		for _, it := range was.Items {
			held[it.ProductID] = true
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkPurchase(ctx, q, scope.CompanyID, by, in, was.SupplierID, held, &current)
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: id, CompanyID: scope.CompanyID, DocAt: c.At, SupplierID: &c.SupplierID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := writeLines(ctx, q, scope.CompanyID, id, was.LocationID, c.Items); err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		doc := ledger.Head{ID: id, Kind: ledger.Purchase, CompanyID: scope.CompanyID, SupplierID: &c.SupplierID, At: c.At}
		if err := ledger.WriteLinkedPayments(ctx, q, doc, in.Payments, by, name); err != nil {
			return err
		}
		// The products out of the purchase now have to stay above zero too.
		products := make([]int64, 0, len(was.Items))
		for _, it := range was.Items {
			products = append(products, it.ProductID)
		}
		if err := ledger.CheckStock(ctx, q, []int64{was.LocationID}, products); err != nil {
			return err
		}
		p, err = getPurchase(ctx, q, scope, id)
		return err
	})
	return p, err
}

// DeletePurchase hides the purchase, takes its moves out of the location's
// stock (what was sold since has to stay above zero) and hides the payments
// entered with it. Its number is never given again.
func (s *Service) DeletePurchase(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getPurchase(ctx, q, scope, id)
		if err != nil {
			return err
		}
		if _, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: scope.CompanyID}); err != nil {
			return err
		}
		if err := ledger.WriteMoves(ctx, q, scope.CompanyID, id, nil); err != nil {
			return err
		}
		products := make([]int64, 0, len(was.Items))
		for _, it := range was.Items {
			products = append(products, it.ProductID)
		}
		if err := ledger.CheckStock(ctx, q, []int64{was.LocationID}, products); err != nil {
			return err
		}
		return q.HideLinkedPayments(ctx, id)
	})
}

// writeLines replaces the purchase's lines with the lines given, writes its
// total, and writes its moves anew: each line into the location's stock,
// which has to stay above zero (what was sold since a line shrank).
func writeLines(ctx context.Context, q *gen.Queries, companyID, purchaseID, locationID int64, items []checkedItem) error {
	if err := q.DeleteTransactionItems(ctx, purchaseID); err != nil {
		return err
	}
	lines := make([]ledger.Line, 0, len(items))
	products := make([]int64, 0, len(items))
	for i, it := range items {
		if err := q.AddTransactionItem(ctx, gen.AddTransactionItemParams{TransactionID: purchaseID, ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price, Position: int32(i + 1)}); err != nil {
			return err
		}
		lines = append(lines, ledger.Line{ProductID: it.ProductID, Quantity: it.Quantity})
		products = append(products, it.ProductID)
	}
	if _, err := q.SetTransactionTotal(ctx, purchaseID); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, purchaseID, ledger.MovesOf(ledger.Purchase, locationID, 0, lines)); err != nil {
		return err
	}
	return ledger.CheckStock(ctx, q, []int64{locationID}, products)
}

// pricingOf is the document's pricing now: its currency and rate row, with
// the rate of that currency in it.
func pricingOf(ctx context.Context, q *gen.Queries, head gen.Transaction) (ledger.Pricing, error) {
	row, err := q.GetRate(ctx, head.CurrencyRateID)
	if err != nil {
		return ledger.Pricing{}, err
	}
	return ledger.Pricing{CurrencyID: head.CurrencyID, RateID: head.CurrencyRateID, Rate: currency.ColumnOf(row, head.CurrencyID)}, nil
}
