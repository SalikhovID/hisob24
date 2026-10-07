package db_test

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// warehouse is a company with a member, two locations, a supplier and two
// products: what the purchase queries need.
type warehouse struct {
	company, asosiy, chilonzor, bozor, olma, nok int64
}

func newWarehouse(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) warehouse {
	t.Helper()
	company := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', 'Ali aka')", enteredBy, company.ID)
	return warehouse{
		company:   company.ID,
		asosiy:    addLocation(t, pool, company.ID, "Asosiy"),
		chilonzor: addLocation(t, pool, company.ID, "Chilonzor"),
		bozor:     createSupplier(t, q, company.ID, "Bozor").ID,
		olma:      createProduct(t, q, company.ID, "product", "Olma", ptr("kg")).ID,
		nok:       createProduct(t, q, company.ID, "product", "Nok", ptr("dona")).ID,
	}
}

// onDay is a DATE as the queries take one.
func onDay(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse(time.DateOnly, s)
	require.NoError(t, err)
	return d
}

func TestNextPurchaseNumberCountsTheCompanysPurchasesDeletedOnesToo(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	nok := createCompany(t, q, "Nok", today(t, pool))

	n, err := q.NextPurchaseNumber(ctx, w.company)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "the first")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	n, err = q.NextPurchaseNumber(ctx, w.company)
	require.NoError(t, err)
	assert.EqualValues(t, 3, n, "a deleted purchase keeps its number")
	n, err = q.NextPurchaseNumber(ctx, nok.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "another company counts its own")
}

func TestCreateAndGetPurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)

	p, err := q.CreatePurchase(ctx, gen.CreatePurchaseParams{
		CompanyID: w.company, Number: 7, LocationID: w.asosiy, SupplierID: w.bozor, PurchasedOn: onDay(t, "2026-10-07"), Note: ptr("Ertalab"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	assert.EqualValues(t, 7, p.Number)
	assert.Equal(t, "0", numericText(t, p.Total), "no lines yet")

	require.NoError(t, q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: p.ID, ProductID: w.olma, Quantity: numeric(t, "12.5"), Price: numeric(t, "1000"), Position: 1}))
	require.NoError(t, q.AddPurchaseItem(ctx, gen.AddPurchaseItemParams{PurchaseID: p.ID, ProductID: w.nok, Quantity: numeric(t, "3"), Price: numeric(t, "2500.5"), Position: 2}))
	total, err := q.SetPurchaseTotal(ctx, p.ID)
	require.NoError(t, err)
	assert.Equal(t, "20001.50", numericText(t, total), "12.5 × 1000 + 3 × 2500.5")

	got, err := q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy, w.chilonzor}})
	require.NoError(t, err)
	assert.EqualValues(t, 7, got.Number)
	assert.Equal(t, "Asosiy", got.LocationName)
	assert.Equal(t, "Bozor", got.SupplierName)
	assert.Equal(t, onDay(t, "2026-10-07"), got.PurchasedOn)
	assert.Equal(t, ptr("Ertalab"), got.Note)
	assert.Equal(t, "20001.50", numericText(t, got.Total))
	assert.Equal(t, "0", numericText(t, got.Paid), "nothing paid")
	assert.EqualValues(t, 2, got.ItemsCount)
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)

	addPayment(t, pool, w.company, w.bozor, &p.ID, "5000", false)
	got, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", numericText(t, got.Paid), "the payment entered with it")

	items, err := q.ListPurchaseItems(ctx, p.ID)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "Olma", items[0].Name, "in the order entered")
	assert.Equal(t, ptr("kg"), items[0].Unit)
	assert.Equal(t, "12.500", numericText(t, items[0].Quantity))
	assert.Equal(t, "1000.00", numericText(t, items[0].Price))
	assert.Equal(t, "12500.00", numericText(t, items[0].Amount))
	assert.Equal(t, "7501.50", numericText(t, items[1].Amount))

	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: w.company, LocationIds: []int64{w.chilonzor}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "outside the member's locations")
	nok := createCompany(t, q, "Nok", today(t, pool))
	_, err = q.GetPurchase(ctx, gen.GetPurchaseParams{ID: p.ID, CompanyID: nok.ID, LocationIds: []int64{w.asosiy}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")
}

func TestListPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-01' WHERE number = 1")
	addPurchase(t, pool, w.company, w.chilonzor, dehqon, w.olma, 2, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE number = 2")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 3, "1", "1", false)
	mustExec(t, pool, "UPDATE purchases SET purchased_on = '2026-10-05' WHERE number = 3")
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", true)
	numbers := func(params gen.ListPurchasesParams) []int32 {
		rows, err := q.ListPurchases(ctx, params)
		require.NoError(t, err)
		out := make([]int32, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Number)
		}
		return out
	}
	all := []int64{w.asosiy, w.chilonzor}

	assert.Equal(t, []int32{3, 2, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 20}), "the newest first, then the later entered; the deleted left out")
	assert.Equal(t, []int32{3, 1}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}, Limit: 20}), "one location")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, SupplierID: &dehqon, Limit: 20}), "one supplier")
	assert.Equal(t, []int32{2}, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: all, Limit: 1, Offset: 1}), "paged")
	assert.Empty(t, numbers(gen.ListPurchasesParams{CompanyID: w.company, LocationIds: []int64{}, Limit: 20}), "a member with no location sees none")
	count, err := q.CountPurchases(ctx, gen.CountPurchasesParams{CompanyID: w.company, LocationIds: []int64{w.asosiy}})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
}

func TestUpdateAndDeletePurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	id := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)

	p, err := q.UpdatePurchase(ctx, gen.UpdatePurchaseParams{ID: id, CompanyID: w.company, SupplierID: dehqon, PurchasedOn: onDay(t, "2026-10-09"), Note: ptr("Kechga")})
	require.NoError(t, err)
	assert.Equal(t, dehqon, p.SupplierID)
	assert.Equal(t, onDay(t, "2026-10-09"), p.PurchasedOn)
	assert.Equal(t, ptr("Kechga"), p.Note)
	assert.EqualValues(t, 1, p.Number, "the number stays")
	assert.Equal(t, w.asosiy, p.LocationID, "the location stays")

	require.NoError(t, q.DeletePurchaseItems(ctx, id))
	items, err := q.ListPurchaseItems(ctx, id)
	require.NoError(t, err)
	assert.Empty(t, items)
	total, err := q.SetPurchaseTotal(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "0", numericText(t, total), "no lines, no total")

	_, err = q.DeletePurchase(ctx, gen.DeletePurchaseParams{ID: id, CompanyID: w.company})
	require.NoError(t, err)
	_, err = q.DeletePurchase(ctx, gen.DeletePurchaseParams{ID: id, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.UpdatePurchase(ctx, gen.UpdatePurchaseParams{ID: id, CompanyID: w.company, SupplierID: dehqon, PurchasedOn: onDay(t, "2026-10-09")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted purchase is not edited")
}

func TestMoveStockMovesAProductsQuantityInALocation(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	quantity := func(locationID, productID int64) string {
		var s string
		require.NoError(t, pool.QueryRow(ctx, "SELECT quantity::text FROM stock WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s))
		return s
	}
	move := func(locationID, productID int64, added, removed string) error {
		if err := q.EnsureStock(ctx, gen.EnsureStockParams{CompanyID: w.company, LocationID: locationID, ProductID: productID}); err != nil {
			return err
		}
		return q.MoveStock(ctx, gen.MoveStockParams{LocationID: locationID, ProductID: productID, Added: numeric(t, added), Removed: numeric(t, removed)})
	}

	require.NoError(t, move(w.asosiy, w.olma, "12.5", "0"), "a first purchase makes the row")
	assert.Equal(t, "12.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "2", "0"), "another adds to it")
	assert.Equal(t, "14.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "3", "2"), "an edit moves by the difference")
	assert.Equal(t, "15.500", quantity(w.asosiy, w.olma))
	require.NoError(t, move(w.asosiy, w.olma, "0", "15.5"), "a deletion takes it back")
	assert.Equal(t, "0.000", quantity(w.asosiy, w.olma))
	var pgErr *pgconn.PgError
	require.ErrorAs(t, move(w.asosiy, w.olma, "0", "0.001"), &pgErr, "below zero")
	assert.Equal(t, "23514", pgErr.Code)
	assert.Equal(t, "stock_quantity_check", pgErr.ConstraintName)
	require.ErrorAs(t, move(w.chilonzor, w.nok, "0", "1"), &pgErr, "taking from a location that has none")
	assert.Equal(t, "stock_quantity_check", pgErr.ConstraintName)
	require.NoError(t, move(w.chilonzor, w.olma, "1", "0"))
	assert.Equal(t, "0.000", quantity(w.asosiy, w.olma), "each location its own")
	assert.Equal(t, "1.000", quantity(w.chilonzor, w.olma))
}

func TestCountLocationPurchases(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)
	addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 2, "1", "1", true)
	addPurchase(t, pool, w.company, w.chilonzor, w.bozor, w.olma, 3, "1", "1", false)

	count, err := q.CountLocationPurchases(ctx, w.asosiy)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count, "the live purchases standing in the location")
}
