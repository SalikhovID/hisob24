package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

var errSaleNotFound = apperr.New(apperr.NotFound, "not_found", "Sotuv topilmadi")

// Sale is a sale as the API shows it (logic/sales.md, section 3): out of a
// location to a customer (none for a retail sale), its lines of products
// and services, what it comes to (in so'm too) and what was paid with it.
type Sale struct {
	ID            int64
	Number        int32
	LocationID    int64
	LocationName  string
	CustomerID    *int64
	CustomerName  *string
	At            time.Time
	CurrencyID    int64
	Rate          string
	Note          *string
	Total         string
	TotalUZS      string
	Paid          string
	ItemsCount    int64
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	// Items are the lines and Payments the payments entered with it, on the
	// sale's own page; a list carries neither.
	Items    []Item
	Payments []LinkedPayment
}

// SaleInput is what a sale is saved with, as the client sent it. The
// location is given apart, on entry alone.
type SaleInput struct {
	CustomerID *int64
	At         string
	CurrencyID *int64
	Rate       *string
	Note       *string
	Items      []ItemInput
	Payments   []ledger.PaymentLine
}

// SaleListInput narrows the sales: LocationID keeps one of the scope's
// locations (0: all of them), CustomerID one customer's (0: everyone's).
// Page starts at 1.
type SaleListInput struct {
	LocationID int64
	CustomerID int64
	Page       int
}

// SalePage is one page of the sales.
type SalePage struct {
	Items    []Sale
	Total    int64
	Page     int
	PageSize int
}

type checkedSale struct {
	CustomerID *int64
	At         time.Time
	Pricing    ledger.Pricing
	Note       *string
	Items      []checkedItem
}

// checkSale reads an input against the company, inside the write, as the
// member with phone by. What is wrong is told in this order
// (logic/sales.md, 3.2): the customer (one of the company's live ones, or
// none), the moment, the currency and the rate (current: the sale's
// pricing now), the note, the lines (at least one; each product or service
// one of the company's, active unless the sale already holds it (held),
// once; its quantity; its price). The payments are read as they are
// written, and a retail sale has to be paid in full after.
func checkSale(ctx context.Context, q *gen.Queries, companyID int64, by string, in SaleInput, held map[int64]bool, current *ledger.Pricing) (checkedSale, error) {
	var c checkedSale
	if in.CustomerID != nil {
		if _, err := q.GetCustomer(ctx, gen.GetCustomerParams{ID: *in.CustomerID, CompanyID: companyID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return c, invalid("Mijozni tanlang")
			}
			return c, err
		}
		id := *in.CustomerID
		c.CustomerID = &id
	}
	var err error
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Pricing, err = ledger.PriceIn(ctx, q, companyID, ledger.PriceInput{CurrencyID: in.CurrencyID, Rate: in.Rate}, c.At, by, current); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	if c.Items, err = checkLines(ctx, q, companyID, in.Items, held, lineRule{WithPrice: true, AllowService: true}); err != nil {
		return c, err
	}
	return c, nil
}

func toSale(r gen.GetSaleRow, items []Item, payments []LinkedPayment) Sale {
	s := Sale{
		ID: r.ID, Number: r.Number, LocationID: r.LocationID, LocationName: r.LocationName, CustomerID: r.CustomerID, CustomerName: r.CustomerName,
		At: r.DocAt.UTC(), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate), Note: r.Note, Total: amount(r.Total), TotalUZS: amount(r.TotalUzs), Paid: amount(r.Paid),
		ItemsCount: r.ItemsCount, CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt, Items: items, Payments: payments,
	}
	// A customer with no name yet goes by their phone.
	if r.CustomerID != nil && (r.CustomerName == nil || *r.CustomerName == "") {
		s.CustomerName = r.CustomerPhone
	}
	return s
}

func getSale(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Sale, error) {
	r, err := q.GetSale(ctx, gen.GetSaleParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return Sale{}, errSaleNotFound
	}
	if err != nil {
		return Sale{}, err
	}
	rows, err := q.ListTransactionItems(ctx, id)
	if err != nil {
		return Sale{}, err
	}
	payments, err := q.ListLinkedPayments(ctx, id)
	if err != nil {
		return Sale{}, err
	}
	return toSale(r, toItems(rows), toLinkedPayments(payments)), nil
}

// ListSales is a page of the sales in the scope's locations, or in the one
// asked for, one customer's when asked, the newest first. The rows carry
// no lines or payments.
func (s *Service) ListSales(ctx context.Context, scope Scope, in SaleListInput) (SalePage, error) {
	if err := pageOf(in.Page); err != nil {
		return SalePage{}, err
	}
	locations := locationsOf(scope, in.LocationID)
	var customerID *int64
	if in.CustomerID != 0 {
		customerID = &in.CustomerID
	}
	total, err := s.q.CountSales(ctx, gen.CountSalesParams{CompanyID: scope.CompanyID, LocationIds: locations, CustomerID: customerID})
	if err != nil {
		return SalePage{}, err
	}
	rows, err := s.q.ListSales(ctx, gen.ListSalesParams{CompanyID: scope.CompanyID, LocationIds: locations, CustomerID: customerID, Limit: PageSize, Offset: int32((in.Page - 1) * PageSize)})
	if err != nil {
		return SalePage{}, err
	}
	items := make([]Sale, 0, len(rows))
	for _, r := range rows {
		items = append(items, toSale(gen.GetSaleRow(r), nil, nil))
	}
	return SalePage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetSale is a sale in the scope's locations, with its lines and the
// payments entered with it.
func (s *Service) GetSale(ctx context.Context, scope Scope, id int64) (Sale, error) {
	return getSale(ctx, s.q, scope, id)
}

// CreateSale enters a sale out of the location (one of the scope's), as
// the member with phone by: numbered next among the sales, its product
// lines out of the location's stock at once (what it lacks is refused,
// 409), and what was paid as the customer's payments linked to it. A sale
// to nobody is paid in full with it. All of it is written, or none.
func (s *Service) CreateSale(ctx context.Context, scope Scope, by string, locationID int64, in SaleInput) (Sale, error) {
	if locationID == 0 || !scope.has(locationID) {
		return Sale{}, errNoLocation
	}
	var sale Sale
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkSale(ctx, q, scope.CompanyID, by, in, nil, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.Sale)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.Sale), Number: number, DocAt: c.At, LocationID: &locationID, CustomerID: c.CustomerID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: zero(), Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeSaleLines(ctx, q, scope.CompanyID, row.ID, locationID, c.Items, nil); err != nil {
			return err
		}
		head := ledger.Head{ID: row.ID, Kind: ledger.Sale, CompanyID: scope.CompanyID, CustomerID: c.CustomerID, At: c.At}
		if err := ledger.WriteLinkedPayments(ctx, q, head, in.Payments, by, name); err != nil {
			return err
		}
		sale, err = getSale(ctx, q, scope, row.ID)
		if err != nil {
			return err
		}
		return paidInFull(sale)
	})
	return sale, err
}

// UpdateSale saves the sale with other fields, lines and payments, as the
// member with phone by. The number and the location stay; the lines and
// the moves are written anew; the payments entered with it are replaced by
// the ones sent, under the customer the sale names now; the products and
// the accounts the sale already names are kept even when inactive. The
// record itself comes first.
func (s *Service) UpdateSale(ctx context.Context, scope Scope, by string, id int64, in SaleInput) (Sale, error) {
	var sale Sale
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getSale(ctx, q, scope, id)
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		old, err := q.ListTransactionItems(ctx, id)
		if err != nil {
			return err
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkSale(ctx, q, scope.CompanyID, by, in, heldOf(old), &current)
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: id, CompanyID: scope.CompanyID, DocAt: c.At, CustomerID: c.CustomerID, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := writeSaleLines(ctx, q, scope.CompanyID, id, was.LocationID, c.Items, productsOfRows(old)); err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		doc := ledger.Head{ID: id, Kind: ledger.Sale, CompanyID: scope.CompanyID, CustomerID: c.CustomerID, At: c.At}
		if err := ledger.WriteLinkedPayments(ctx, q, doc, in.Payments, by, name); err != nil {
			return err
		}
		sale, err = getSale(ctx, q, scope, id)
		if err != nil {
			return err
		}
		return paidInFull(sale)
	})
	return sale, err
}

// DeleteSale hides the sale, gives its products back to the location's
// stock and hides the payments entered with it. Its number is never given
// again.
func (s *Service) DeleteSale(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		if _, err := getSale(ctx, q, scope, id); err != nil {
			return err
		}
		if _, err := q.DeleteTransaction(ctx, gen.DeleteTransactionParams{ID: id, CompanyID: scope.CompanyID}); err != nil {
			return err
		}
		if err := ledger.WriteMoves(ctx, q, scope.CompanyID, id, nil); err != nil {
			return err
		}
		return q.HideLinkedPayments(ctx, id)
	})
}

// paidInFull refuses a retail sale that is not paid exactly in full with
// it (logic/sales.md, 3.1): the payments, each turned into the sale's
// currency, have to come to the total.
func paidInFull(sale Sale) error {
	if sale.CustomerID == nil && sale.Paid != sale.Total {
		return invalid("Mijozsiz sotuv to'liq to'langan bo'lsin")
	}
	return nil
}

// writeSaleLines replaces the sale's lines, writes its total and its moves
// anew (each product line out of the location's stock, a service moving
// nothing), and checks the stock for the products of the lines and the
// ones given besides (the old lines').
func writeSaleLines(ctx context.Context, q *gen.Queries, companyID, saleID, locationID int64, items []checkedItem, more []int64) error {
	if err := writeGoodsLines(ctx, q, saleID, items); err != nil {
		return err
	}
	if _, err := q.SetTransactionTotal(ctx, saleID); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, saleID, ledger.MovesOf(ledger.Sale, locationID, 0, linesOf(items))); err != nil {
		return err
	}
	return ledger.CheckStock(ctx, q, []int64{locationID}, append(productsOf(items), more...))
}
