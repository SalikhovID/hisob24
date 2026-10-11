package warehouse

import (
	"context"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/currency"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// OpeningStock is the stock a location starts with, as the API shows it
// (logic/warehouse.md, 5.3): like a purchase without a supplier or
// payments, in a currency with a rate.
type OpeningStock struct {
	goodsHead
	CurrencyID int64
	Rate       string
	Total      string
	TotalUZS   string
	// Items are the lines, in the order entered; a list carries none.
	Items []Item
}

// OpeningStockInput is what an opening stock is saved with, as the client
// sent it. The location is given apart, on entry alone.
type OpeningStockInput struct {
	At         string
	CurrencyID *int64
	Rate       *string
	Note       *string
	Items      []ItemInput
}

// OpeningStockPage is one page of the opening stocks.
type OpeningStockPage struct {
	Items    []OpeningStock
	Total    int64
	Page     int
	PageSize int
}

type checkedOpeningStock struct {
	At      time.Time
	Pricing ledger.Pricing
	Note    *string
	Items   []checkedItem
}

// checkOpeningStock reads an input, inside the write, as the member with
// phone by: the moment, the currency and the rate (current: the document's
// pricing now), the note, the lines (a quantity above zero, a price).
func checkOpeningStock(ctx context.Context, q *gen.Queries, companyID int64, by string, in OpeningStockInput, held map[int64]bool, current *ledger.Pricing) (checkedOpeningStock, error) {
	var c checkedOpeningStock
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
	if c.Items, err = checkLines(ctx, q, companyID, in.Items, held, lineRule{WithPrice: true, ServiceRefused: "Xizmat ombor hujjatiga kiritilmaydi"}); err != nil {
		return c, err
	}
	return c, nil
}

func toOpeningStock(r gen.GetGoodsDocumentRow, items []Item) OpeningStock {
	return OpeningStock{goodsHead: toGoodsHead(r), CurrencyID: r.CurrencyID, Rate: currency.RateText(r.Rate), Total: amount(r.Total), TotalUZS: amount(r.TotalUzs), Items: items}
}

func getOpeningStock(ctx context.Context, q *gen.Queries, scope Scope, id int64) (OpeningStock, error) {
	r, err := getGoodsDocument(ctx, q, scope, ledger.OpeningStock, id, errOpeningStockNotFound)
	if err != nil {
		return OpeningStock{}, err
	}
	rows, err := q.ListTransactionItems(ctx, id)
	if err != nil {
		return OpeningStock{}, err
	}
	return toOpeningStock(r, toItems(rows)), nil
}

// ListOpeningStock is a page of the opening stocks of the scope's
// locations, or of the one asked for, the newest first.
func (s *Service) ListOpeningStock(ctx context.Context, scope Scope, in DocumentListInput) (OpeningStockPage, error) {
	rows, total, err := listGoodsDocuments(ctx, s.q, scope.CompanyID, ledger.OpeningStock, locationsOf(scope, in.LocationID), in.Page)
	if err != nil {
		return OpeningStockPage{}, err
	}
	items := make([]OpeningStock, 0, len(rows))
	for _, r := range rows {
		items = append(items, toOpeningStock(gen.GetGoodsDocumentRow(r), nil))
	}
	return OpeningStockPage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetOpeningStock is an opening stock of the scope's locations, with its lines.
func (s *Service) GetOpeningStock(ctx context.Context, scope Scope, id int64) (OpeningStock, error) {
	return getOpeningStock(ctx, s.q, scope, id)
}

// CreateOpeningStock enters the stock the location (one of the scope's)
// starts with, as the member with phone by: numbered next among the
// opening stocks, its lines into the location's stock at once.
func (s *Service) CreateOpeningStock(ctx context.Context, scope Scope, by string, locationID int64, in OpeningStockInput) (OpeningStock, error) {
	if locationID == 0 || !scope.has(locationID) {
		return OpeningStock{}, errNoLocation
	}
	var o OpeningStock
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkOpeningStock(ctx, q, scope.CompanyID, by, in, nil, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.OpeningStock)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.OpeningStock), Number: number, DocAt: c.At, LocationID: &locationID,
			CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Total: zero(), Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeOpeningLines(ctx, q, scope.CompanyID, row.ID, locationID, c.Items, nil); err != nil {
			return err
		}
		o, err = getOpeningStock(ctx, q, scope, row.ID)
		return err
	})
	return o, err
}

// UpdateOpeningStock saves the opening stock with another moment, currency,
// rate, lines and note, as the member with phone by; the number and the
// location stay. The products it already names are kept even when inactive.
func (s *Service) UpdateOpeningStock(ctx context.Context, scope Scope, by string, id int64, in OpeningStockInput) (OpeningStock, error) {
	var o OpeningStock
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getOpeningStock(ctx, q, scope, id)
		if err != nil {
			return err
		}
		old, err := q.ListTransactionItems(ctx, id)
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		current, err := pricingOf(ctx, q, head)
		if err != nil {
			return err
		}
		c, err := checkOpeningStock(ctx, q, scope.CompanyID, by, in, heldOf(old), &current)
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: scope.CompanyID, DocAt: c.At, CurrencyID: c.Pricing.CurrencyID, CurrencyRateID: c.Pricing.RateID, Note: c.Note}); err != nil {
			return err
		}
		if err := writeOpeningLines(ctx, q, scope.CompanyID, id, was.LocationID, c.Items, productsOfRows(old)); err != nil {
			return err
		}
		o, err = getOpeningStock(ctx, q, scope, id)
		return err
	})
	return o, err
}

// DeleteOpeningStock hides the opening stock and takes its moves back
// (what was sold since has to stay above zero, 409).
func (s *Service) DeleteOpeningStock(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getOpeningStock(ctx, q, scope, id)
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
		return ledger.CheckStock(ctx, q, []int64{was.LocationID}, products)
	})
}

// writeOpeningLines replaces the lines, writes the total and the moves
// anew, and checks the location's stock.
func writeOpeningLines(ctx context.Context, q *gen.Queries, companyID, openingID, locationID int64, items []checkedItem, more []int64) error {
	if err := writeGoodsLines(ctx, q, openingID, items); err != nil {
		return err
	}
	if _, err := q.SetTransactionTotal(ctx, openingID); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, openingID, ledger.MovesOf(ledger.OpeningStock, locationID, 0, linesOf(items))); err != nil {
		return err
	}
	return ledger.CheckStock(ctx, q, []int64{locationID}, append(productsOf(items), more...))
}
