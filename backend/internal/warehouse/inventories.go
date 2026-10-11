package warehouse

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// Inventory is a count of a location's stock as the API shows it
// (logic/warehouse.md, 5.2): each product with what the journal expected
// at its moment, what was counted and the difference, which moves the
// stock.
type Inventory struct {
	goodsHead
	// Items are the lines, in the order entered; a list carries none.
	Items []InventoryItem
}

// InventoryItem is a line of an inventory.
type InventoryItem struct {
	ProductID  int64
	Name       string
	Unit       *string
	Expected   string
	Counted    string
	Difference string
}

// InventoryInput is what an inventory is saved with, as the client sent it:
// the moment, the lines (each product with what was counted) and a note.
// The location is given apart, on entry alone.
type InventoryInput struct {
	At    string
	Note  *string
	Items []ItemInput
}

// InventoryPage is one page of the inventories.
type InventoryPage struct {
	Items    []Inventory
	Total    int64
	Page     int
	PageSize int
}

type checkedInventory struct {
	At    time.Time
	Note  *string
	Items []checkedItem
}

// checkInventory reads an input, inside the write: the moment, the note,
// the lines (what was counted: not below zero).
func checkInventory(ctx context.Context, q *gen.Queries, companyID int64, in InventoryInput, held map[int64]bool) (checkedInventory, error) {
	var c checkedInventory
	var err error
	if c.At, err = ledger.At(in.At); err != nil {
		return c, err
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return c, err
	}
	if c.Items, err = checkLines(ctx, q, companyID, in.Items, held, lineRule{AllowZero: true, ServiceRefused: "Xizmat ombor hujjatiga kiritilmaydi"}); err != nil {
		return c, err
	}
	return c, nil
}

func toInventoryItems(rows []gen.ListTransactionItemsRow) []InventoryItem {
	items := make([]InventoryItem, 0, len(rows))
	for _, r := range rows {
		expected := r.Expected
		if !expected.Valid {
			expected = zero()
		}
		items = append(items, InventoryItem{
			ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Expected: quantity(expected), Counted: quantity(r.Quantity), Difference: quantity(ledger.Sub(r.Quantity, expected)),
		})
	}
	return items
}

func getInventory(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Inventory, error) {
	r, err := getGoodsDocument(ctx, q, scope, ledger.Inventory, id, errInventoryNotFound)
	if err != nil {
		return Inventory{}, err
	}
	rows, err := q.ListTransactionItems(ctx, id)
	if err != nil {
		return Inventory{}, err
	}
	return Inventory{goodsHead: toGoodsHead(r), Items: toInventoryItems(rows)}, nil
}

// ListInventories is a page of the inventories of the scope's locations, or
// of the one asked for, the newest first. The rows carry no lines.
func (s *Service) ListInventories(ctx context.Context, scope Scope, in DocumentListInput) (InventoryPage, error) {
	rows, total, err := listGoodsDocuments(ctx, s.q, scope.CompanyID, ledger.Inventory, locationsOf(scope, in.LocationID), in.Page)
	if err != nil {
		return InventoryPage{}, err
	}
	items := make([]Inventory, 0, len(rows))
	for _, r := range rows {
		items = append(items, Inventory{goodsHead: toGoodsHead(gen.GetGoodsDocumentRow(r))})
	}
	return InventoryPage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetInventory is an inventory of the scope's locations, with its lines.
func (s *Service) GetInventory(ctx context.Context, scope Scope, id int64) (Inventory, error) {
	return getInventory(ctx, s.q, scope, id)
}

// CreateInventory enters a count of the location's stock (one of the
// scope's), as the member with phone by: each line takes the stock the
// journal expected at the moment, and the difference moves the stock; what
// the location would lack now is refused (409).
func (s *Service) CreateInventory(ctx context.Context, scope Scope, by string, locationID int64, in InventoryInput) (Inventory, error) {
	if locationID == 0 || !scope.has(locationID) {
		return Inventory{}, errNoLocation
	}
	var inv Inventory
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkInventory(ctx, q, scope.CompanyID, in, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := ledger.NextNumber(ctx, q, scope.CompanyID, ledger.Inventory)
		if err != nil {
			return err
		}
		pricing, err := ledger.PriceIn(ctx, q, scope.CompanyID, ledger.PriceInput{}, c.At, by, nil)
		if err != nil {
			return err
		}
		row, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: scope.CompanyID, Kind: string(ledger.Inventory), Number: number, DocAt: c.At, LocationID: &locationID,
			CurrencyID: pricing.CurrencyID, CurrencyRateID: pricing.RateID, Total: zero(), Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeInventoryLines(ctx, q, scope.CompanyID, row.ID, locationID, c.At, c.Items, nil); err != nil {
			return err
		}
		inv, err = getInventory(ctx, q, scope, row.ID)
		return err
	})
	return inv, err
}

// UpdateInventory saves the inventory with another moment, lines and note:
// what the journal expected is counted anew at the moment (without the
// inventory's own moves), and the stock follows. The number and the
// location stay; the products it already names are kept even when inactive.
func (s *Service) UpdateInventory(ctx context.Context, scope Scope, id int64, in InventoryInput) (Inventory, error) {
	var inv Inventory
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getInventory(ctx, q, scope, id)
		if err != nil {
			return err
		}
		old, err := q.ListTransactionItems(ctx, id)
		if err != nil {
			return err
		}
		c, err := checkInventory(ctx, q, scope.CompanyID, in, heldOf(old))
		if err != nil {
			return err
		}
		head, err := q.GetTransaction(ctx, gen.GetTransactionParams{ID: id, CompanyID: scope.CompanyID})
		if err != nil {
			return err
		}
		if _, err := q.UpdateTransaction(ctx, gen.UpdateTransactionParams{ID: id, CompanyID: scope.CompanyID, DocAt: c.At, CurrencyID: head.CurrencyID, CurrencyRateID: head.CurrencyRateID, Note: c.Note}); err != nil {
			return err
		}
		if err := writeInventoryLines(ctx, q, scope.CompanyID, id, was.LocationID, c.At, c.Items, productsOfRows(old)); err != nil {
			return err
		}
		inv, err = getInventory(ctx, q, scope, id)
		return err
	})
	return inv, err
}

// DeleteInventory hides the inventory and takes its moves back (what the
// location would lack now is refused, 409).
func (s *Service) DeleteInventory(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getInventory(ctx, q, scope, id)
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

// writeInventoryLines gives each line the stock the journal expected at the
// moment (the inventory's own moves left out), writes the lines and the
// moves (the differences) anew, and checks the location's stock for the
// products of the lines and the ones given besides.
func writeInventoryLines(ctx context.Context, q *gen.Queries, companyID, inventoryID, locationID int64, at time.Time, items []checkedItem, more []int64) error {
	rows, err := q.ListStockAt(ctx, gen.ListStockAtParams{LocationID: locationID, At: at, ExcludeID: inventoryID})
	if err != nil {
		return err
	}
	expected := make(map[int64]pgtype.Numeric, len(rows))
	for _, r := range rows {
		expected[r.ProductID] = r.Quantity
	}
	for i := range items {
		if e, ok := expected[items[i].ProductID]; ok {
			items[i].Expected = e
		} else {
			items[i].Expected = zero()
		}
	}
	if err := writeGoodsLines(ctx, q, inventoryID, items); err != nil {
		return err
	}
	if err := ledger.WriteMoves(ctx, q, companyID, inventoryID, ledger.MovesOf(ledger.Inventory, locationID, 0, linesOf(items))); err != nil {
		return err
	}
	return ledger.CheckStock(ctx, q, []int64{locationID}, append(productsOf(items), more...))
}
