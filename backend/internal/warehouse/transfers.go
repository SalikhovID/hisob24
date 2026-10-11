package warehouse

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// Transfer is a transfer between two locations as the API shows it
// (logic/warehouse.md, 5.1): out of one, into the other, at once.
type Transfer struct {
	goodsHead
	ToLocationID   int64
	ToLocationName string
	// Items are the lines, in the order entered; a list carries none.
	Items []TransferItem
}

// TransferItem is a line of a transfer: a product and a quantity.
type TransferItem struct {
	ProductID int64
	Name      string
	Unit      *string
	Quantity  string
}

// TransferInput is what a transfer is saved with, as the client sent it.
// The location it comes out of is given apart, on entry alone.
type TransferInput struct {
	ToLocationID int64
	At           string
	Note         *string
	Items        []ItemInput
}

// TransferPage is one page of the transfers.
type TransferPage struct {
	Items    []Transfer
	Total    int64
	Page     int
	PageSize int
}

type checkedTransfer struct {
	ToLocationID int64
	At           time.Time
	Note         *string
	Items        []checkedItem
}

// checkTransfer reads an input, inside the write. What is wrong is told in
// this order: the other location (one of the company's live ones, not the
// one it comes out of), the moment, the note, the lines.
func checkTransfer(ctx context.Context, q *gen.Queries, companyID, locationID int64, in TransferInput, held map[int64]bool) (checkedTransfer, error) {
	c := checkedTransfer{ToLocationID: in.ToLocationID}
	if in.ToLocationID == 0 {
		return c, invalid("Maqsad lokatsiyani tanlang")
	}
	if _, err := q.GetLocation(ctx, gen.GetLocationParams{ID: in.ToLocationID, CompanyID: companyID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, invalid("Maqsad lokatsiyani tanlang")
		}
		return c, err
	}
	if in.ToLocationID == locationID {
		return c, invalid("Maqsad lokatsiya boshqa bo'lsin")
	}
	var err error
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	if c.Items, err = checkLines(ctx, q, companyID, in.Items, held, lineRule{ServiceRefused: "Xizmat ombor hujjatiga kiritilmaydi"}); err != nil {
		return c, err
	}
	return c, nil
}

func toTransfer(r gen.GetGoodsDocumentRow, items []TransferItem) Transfer {
	t := Transfer{goodsHead: toGoodsHead(r), Items: items}
	if r.ToLocationID != nil {
		t.ToLocationID = *r.ToLocationID
	}
	if r.ToLocationName != nil {
		t.ToLocationName = *r.ToLocationName
	}
	return t
}

func toTransferItems(rows []gen.ListTransactionItemsRow) []TransferItem {
	items := make([]TransferItem, 0, len(rows))
	for _, r := range rows {
		items = append(items, TransferItem{ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Quantity: quantity(r.Quantity)})
	}
	return items
}

func getTransfer(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Transfer, error) {
	r, err := getGoodsDocument(ctx, q, scope, ledger.Transfer, id, errTransferNotFound)
	if err != nil {
		return Transfer{}, err
	}
	rows, err := q.ListTransactionItems(ctx, id)
	if err != nil {
		return Transfer{}, err
	}
	return toTransfer(r, toTransferItems(rows)), nil
}

// ListTransfers is a page of the transfers out of or into the scope's
// locations, or the one asked for, the newest first. The rows carry no lines.
func (s *Service) ListTransfers(ctx context.Context, scope Scope, in DocumentListInput) (TransferPage, error) {
	rows, total, err := listGoodsDocuments(ctx, s.q, scope.CompanyID, ledger.Transfer, locationsOf(scope, in.LocationID), in.Page)
	if err != nil {
		return TransferPage{}, err
	}
	items := make([]Transfer, 0, len(rows))
	for _, r := range rows {
		items = append(items, toTransfer(gen.GetGoodsDocumentRow(r), nil))
	}
	return TransferPage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetTransfer is a transfer out of or into the scope's locations, with its lines.
func (s *Service) GetTransfer(ctx context.Context, scope Scope, id int64) (Transfer, error) {
	return getTransfer(ctx, s.q, scope, id)
}

// CreateTransfer moves products out of the location (one of the scope's)
// into another of the company's, as the member with phone by: numbered
// next among the transfers, out of the one and into the other at once;
// what the location lacks is refused (409).
func (s *Service) CreateTransfer(ctx context.Context, scope Scope, by string, locationID int64, in TransferInput) (Transfer, error) {
	if locationID == 0 || !scope.has(locationID) {
		return Transfer{}, errNoLocation
	}
	var t Transfer
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkTransfer(ctx, q, scope.CompanyID, locationID, in, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.Transfer)
		if err != nil {
			return err
		}
		pricing, err := ledger.PriceIn(ctx, q, scope.CompanyID, ledger.PriceInput{}, c.At, by, nil)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.Transfer), Number: number, DocAt: c.At, LocationID: &locationID, ToLocationID: &c.ToLocationID,
			CurrencyID: pricing.CurrencyID, CurrencyRateID: pricing.RateID, Total: zero(), Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeTransferLines(ctx, q, scope.CompanyID, row.ID, locationID, c.ToLocationID, c.Items, nil); err != nil {
			return err
		}
		t, err = getTransfer(ctx, q, scope, row.ID)
		return err
	})
	return t, err
}

// UpdateTransfer saves the transfer with another destination, moment, lines
// and note; the number and the location it comes out of stay, and that
// location has to be the member's (a transfer seen from its other end
// alone is not theirs to change: 403). The products it already names are
// kept even when inactive.
func (s *Service) UpdateTransfer(ctx context.Context, scope Scope, id int64, in TransferInput) (Transfer, error) {
	var t Transfer
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getTransfer(ctx, q, scope, id)
		if err != nil {
			return err
		}
		if !scope.has(was.LocationID) {
			return errForbidden
		}
		old, err := q.ListTransactionItems(ctx, id)
		if err != nil {
			return err
		}
		c, err := checkTransfer(ctx, q, scope.CompanyID, was.LocationID, in, heldOf(old))
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{
			ID: id, CompanyID: scope.CompanyID, DocAt: c.At, ToLocationID: &c.ToLocationID, CurrencyID: head.CurrencyID, CurrencyRateID: head.CurrencyRateID, Note: c.Note,
		}); err != nil {
			return err
		}
		if err := writeTransferLines(ctx, q, scope.CompanyID, id, was.LocationID, c.ToLocationID, c.Items, append(productsOfRows(old), 0)); err != nil {
			return err
		}
		// The old destination has to stay above zero too, if it changed.
		if was.ToLocationID != c.ToLocationID {
			if err := ledger.CheckStock(ctx, q, []int64{was.ToLocationID}, productsOfRows(old)); err != nil {
				return err
			}
		}
		t, err = getTransfer(ctx, q, scope, id)
		return err
	})
	return t, err
}

// DeleteTransfer hides the transfer and takes its moves back: what came
// into the other location has to be there still (409). The location it
// comes out of has to be the member's (403).
func (s *Service) DeleteTransfer(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getTransfer(ctx, q, scope, id)
		if err != nil {
			return err
		}
		if !scope.has(was.LocationID) {
			return errForbidden
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
		return ledger.CheckStock(ctx, q, []int64{was.LocationID, was.ToLocationID}, products)
	})
}

// writeTransferLines replaces the transfer's lines and writes its moves
// anew: out of the location, into the other; both have to stay above zero
// for the products of the old lines (more) and the new.
func writeTransferLines(ctx context.Context, q *gen.Queries, companyID, transferID, locationID, toLocationID int64, items []checkedItem, more []int64) error {
	if err := writeGoodsLines(ctx, q, transferID, items); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, transferID, ledger.MovesOf(ledger.Transfer, locationID, toLocationID, linesOf(items))); err != nil {
		return err
	}
	return ledger.CheckStock(ctx, q, []int64{locationID, toLocationID}, append(productsOf(items), more...))
}
