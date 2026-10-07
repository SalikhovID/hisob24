package warehouse

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Purchase is a purchase as the API shows it: its head, what it comes to,
// what was paid with it, and (on its own page) its lines.
type Purchase struct {
	ID            int64
	Number        int32
	LocationID    int64
	LocationName  string
	SupplierID    int64
	SupplierName  string
	PurchasedOn   time.Time
	Note          *string
	Total         string
	Paid          string
	ItemsCount    int64
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	// Items are the lines, in the order entered; a list carries none.
	Items []Item
}

// Item is a line of a purchase: a product, a quantity, a price and what the
// line comes to.
type Item struct {
	ProductID int64
	Name      string
	Unit      *string
	Quantity  string
	Price     string
	Amount    string
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
	SupplierID  int64
	PurchasedOn string
	Note        *string
	Items       []ItemInput
	Paid        *string
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
	SupplierID  int64
	PurchasedOn time.Time
	Note        *string
	Items       []checkedItem
	Paid        pgtype.Numeric
}

// checkPurchase reads an input against the company, inside the write. What
// is wrong is told in this order (logic/warehouse.md, 4.2): the supplier
// (one of the company's; active unless it is the one the purchase already
// names, keep), the day, the note, the lines (at least one; each product one
// of the company's, a product not a service, active unless the purchase
// already holds it (held), once; its quantity; its price), what was paid.
func checkPurchase(ctx context.Context, q *gen.Queries, companyID int64, in PurchaseInput, keep int64, held map[int64]bool) (checkedPurchase, error) {
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
	if c.PurchasedOn, err = day(in.PurchasedOn); err != nil {
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
	if c.Paid, err = catalog.Money(in.Paid, "To'langan summa noto'g'ri"); err != nil {
		return c, err
	}
	return c, nil
}

func toPurchase(r gen.GetPurchaseRow, items []Item) Purchase {
	return Purchase{
		ID: r.ID, Number: r.Number, LocationID: r.LocationID, LocationName: r.LocationName, SupplierID: r.SupplierID, SupplierName: r.SupplierName,
		PurchasedOn: r.PurchasedOn, Note: r.Note, Total: amount(r.Total), Paid: amount(r.Paid), ItemsCount: r.ItemsCount,
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt, Items: items,
	}
}

func toItems(rows []gen.ListPurchaseItemsRow) []Item {
	items := make([]Item, 0, len(rows))
	for _, r := range rows {
		items = append(items, Item{ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Quantity: quantity(r.Quantity), Price: amount(r.Price), Amount: amount(r.Amount)})
	}
	return items
}

// getPurchase is the purchase with its lines, in the scope's locations; one
// outside them is not found.
func getPurchase(ctx context.Context, q *gen.Queries, scope Scope, id int64) (Purchase, error) {
	r, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: id, CompanyID: scope.CompanyID, LocationIds: scope.LocationIDs})
	if errors.Is(err, pgx.ErrNoRows) {
		return Purchase{}, errPurchaseNotFound
	}
	if err != nil {
		return Purchase{}, err
	}
	rows, err := q.ListPurchaseItems(ctx, id)
	if err != nil {
		return Purchase{}, err
	}
	return toPurchase(r, toItems(rows)), nil
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
		items = append(items, toPurchase(gen.GetPurchaseRow(r), nil))
	}
	return PurchasePage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetPurchase is a purchase in the scope's locations, with its lines.
func (s *Service) GetPurchase(ctx context.Context, scope Scope, id int64) (Purchase, error) {
	return getPurchase(ctx, s.q, scope, id)
}

// CreatePurchase enters a purchase into the location (one of the scope's),
// as the member with phone by: numbered next in the company, its lines into
// the location's stock at once, and what was paid as a payment linked to it.
// All of it is written, or none.
func (s *Service) CreatePurchase(ctx context.Context, scope Scope, by string, locationID int64, in PurchaseInput) (Purchase, error) {
	// The location is one the member works in (the handler has refused
	// another with 403 already; here it is no location at all).
	if locationID == 0 || !scope.has(locationID) {
		return Purchase{}, errNoLocation
	}
	var p Purchase
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		c, err := checkPurchase(ctx, q, scope.CompanyID, in, 0, nil)
		if err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		number, err := q.NextPurchaseNumber(ctx, scope.CompanyID)
		if err != nil {
			return err
		}
		row, err := q.CreatePurchase(ctx, gen.CreatePurchaseParams{
			CompanyID: scope.CompanyID, Number: number, LocationID: locationID, SupplierID: c.SupplierID, PurchasedOn: c.PurchasedOn, Note: c.Note,
			CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := writeLines(ctx, q, scope.CompanyID, row.ID, locationID, nil, c.Items); err != nil {
			return err
		}
		if err := settle(ctx, q, scope.CompanyID, by, name, row.ID, c); err != nil {
			return err
		}
		p, err = getPurchase(ctx, q, scope, row.ID)
		return err
	})
	return p, err
}

// UpdatePurchase saves the purchase with other fields and lines, as the
// member with phone by (who enters a payment that appears). The number and
// the location stay; the lines are written anew and the stock moves by the
// difference; the supplier and the products the purchase already names are
// kept even when inactive. The record itself comes first.
func (s *Service) UpdatePurchase(ctx context.Context, scope Scope, by string, id int64, in PurchaseInput) (Purchase, error) {
	var p Purchase
	err := s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getPurchase(ctx, q, scope, id)
		if err != nil {
			return err
		}
		held := make(map[int64]bool, len(was.Items))
		for _, it := range was.Items {
			held[it.ProductID] = true
		}
		c, err := checkPurchase(ctx, q, scope.CompanyID, in, was.SupplierID, held)
		if err != nil {
			return err
		}
		if _, err := q.UpdatePurchase(ctx, gen.UpdatePurchaseParams{ID: id, CompanyID: scope.CompanyID, SupplierID: c.SupplierID, PurchasedOn: c.PurchasedOn, Note: c.Note}); err != nil {
			return err
		}
		old, err := q.ListPurchaseItems(ctx, id)
		if err != nil {
			return err
		}
		if err := writeLines(ctx, q, scope.CompanyID, id, was.LocationID, old, c.Items); err != nil {
			return err
		}
		name, err := memberName(ctx, q, scope.CompanyID, by)
		if err != nil {
			return err
		}
		if err := settle(ctx, q, scope.CompanyID, by, name, id, c); err != nil {
			return err
		}
		p, err = getPurchase(ctx, q, scope, id)
		return err
	})
	return p, err
}

// DeletePurchase hides the purchase, takes its lines out of the location's
// stock and hides the payment entered with it. Its number is never given
// again.
func (s *Service) DeletePurchase(ctx context.Context, scope Scope, id int64) error {
	return s.write(ctx, scope.CompanyID, func(q *gen.Queries) error {
		was, err := getPurchase(ctx, q, scope, id)
		if err != nil {
			return err
		}
		old, err := q.ListPurchaseItems(ctx, id)
		if err != nil {
			return err
		}
		if _, err := q.DeletePurchase(ctx, gen.DeletePurchaseParams{ID: id, CompanyID: scope.CompanyID}); err != nil {
			return err
		}
		for _, it := range old {
			if err := moveStock(ctx, q, scope.CompanyID, was.LocationID, it.ProductID, zero, it.Quantity); err != nil {
				return err
			}
		}
		return q.DeletePurchasePayment(ctx, id)
	})
}

// writeLines replaces the purchase's lines with the lines given, writes its
// total, and moves the location's stock by the difference, product by
// product: what was there is removed, what is given is added.
func writeLines(ctx context.Context, q *gen.Queries, companyID, purchaseID, locationID int64, was []gen.ListPurchaseItemsRow, items []checkedItem) error {
	if err := q.DeletePurchaseItems(ctx, purchaseID); err != nil {
		return err
	}
	for i, it := range items {
		if err := q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: purchaseID, ProductID: it.ProductID, Quantity: it.Quantity, Price: it.Price, Position: int32(i + 1)}); err != nil {
			return err
		}
	}
	if _, err := q.SetPurchaseTotal(ctx, purchaseID); err != nil {
		return err
	}
	removed := make(map[int64]pgtype.Numeric, len(was))
	order := make([]int64, 0, len(was)+len(items))
	for _, w := range was {
		removed[w.ProductID] = w.Quantity
		order = append(order, w.ProductID)
	}
	added := make(map[int64]pgtype.Numeric, len(items))
	for _, it := range items {
		added[it.ProductID] = it.Quantity
		if _, ok := removed[it.ProductID]; !ok {
			order = append(order, it.ProductID)
		}
	}
	for _, productID := range order {
		add, ok := added[productID]
		if !ok {
			add = zero
		}
		remove, ok := removed[productID]
		if !ok {
			remove = zero
		}
		if err := moveStock(ctx, q, companyID, locationID, productID, add, remove); err != nil {
			return err
		}
	}
	return nil
}

// settle keeps the payment entered with the purchase as what was paid says:
// made (by the member saving) when something is paid and none is there,
// moved to the purchase's supplier, amount and day when one is there, hidden
// when nothing is paid now.
func settle(ctx context.Context, q *gen.Queries, companyID int64, by string, byName *string, purchaseID int64, c checkedPurchase) error {
	_, err := q.GetPurchasePayment(ctx, purchaseID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if catalog.Zero(c.Paid) {
			return nil
		}
		_, err = q.CreatePayment(ctx, gen.CreatePaymentParams{
			CompanyID: companyID, SupplierID: c.SupplierID, PurchaseID: &purchaseID, Amount: c.Paid, PaidOn: c.PurchasedOn,
			CreatedBy: by, CreatedByName: byName,
		})
		return err
	case err != nil:
		return err
	case catalog.Zero(c.Paid):
		return q.DeletePurchasePayment(ctx, purchaseID)
	default:
		return q.UpdatePurchasePayment(ctx, gen.UpdatePurchasePaymentParams{PurchaseID: purchaseID, SupplierID: c.SupplierID, Amount: c.Paid, PaidOn: c.PurchasedOn})
	}
}
