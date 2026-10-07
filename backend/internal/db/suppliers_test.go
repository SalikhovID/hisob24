package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// createSupplier enters a supplier of the company, as enteredBy.
func createSupplier(t *testing.T, q *gen.Queries, companyID int64, name string) gen.Supplier {
	t.Helper()
	s, err := q.CreateSupplier(t.Context(), gen.CreateSupplierParams{CompanyID: companyID, Name: name, CreatedBy: enteredBy})
	require.NoError(t, err)
	return s
}

// addPurchase enters a purchase of the supplier in the location with one
// line (quantity × price) and returns its id; deleted hides it.
func addPurchase(t *testing.T, pool *pgxpool.Pool, companyID, locationID, supplierID, productID int64, number int32, quantity, price string, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), `INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, total, created_by, deleted_at)
		VALUES ($1, $2, $3, $4, '2026-10-07', ($5::numeric * $6::numeric), $7, CASE WHEN $8 THEN now() END) RETURNING id`,
		companyID, number, locationID, supplierID, quantity, price, enteredBy, deleted).Scan(&id))
	mustExec(t, pool, "INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position) VALUES ($1, $2, $3::numeric, $4::numeric, 1)", id, productID, quantity, price)
	return id
}

// addPayment enters a payment to the supplier, linked to purchaseID when
// one is given; deleted hides it.
func addPayment(t *testing.T, pool *pgxpool.Pool, companyID, supplierID int64, purchaseID *int64, amount string, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(context.Background(), `INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, created_by, deleted_at)
		VALUES ($1, $2, $3, $4::numeric, '2026-10-07', $5, CASE WHEN $6 THEN now() END) RETURNING id`,
		companyID, supplierID, purchaseID, amount, enteredBy, deleted).Scan(&id))
	return id
}

func TestCreateSupplier(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")

	s, err := q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Bozor", Phone: ptr("998901234567"), Note: ptr("Chorsu"), CreatedBy: enteredBy, CreatedByName: ptr("Ali aka")})

	require.NoError(t, err)
	assert.Positive(t, s.ID)
	assert.Equal(t, "Bozor", s.Name)
	assert.Equal(t, ptr("998901234567"), s.Phone)
	assert.Equal(t, ptr("Chorsu"), s.Note)
	assert.True(t, s.IsActive)
	assert.Equal(t, ptr("Ali aka"), s.CreatedByName)
	_, err = q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "bozor", CreatedBy: enteredBy})
	assert.Equal(t, "23505", sqlState(err), "the name is taken, whatever the case")
}

func TestGetSupplierTellsItsBalance(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	mustExec(t, pool, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'user', 'Ali aka')", enteredBy, olma.ID)
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	product := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))

	s, err := q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "0", numericText(t, s.PurchasesTotal), "nothing bought yet")
	assert.Equal(t, "0", numericText(t, s.PaymentsTotal))
	assert.Equal(t, "0", numericText(t, s.Balance))
	assert.Equal(t, ptr("Ali aka"), s.CreatedByName, "the name the member goes by now")

	one := addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 1, "10", "1000", false)
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 2, "5", "1000", true)
	addPayment(t, pool, olma.ID, bozor.ID, &one, "2500.50", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "100", true)
	s, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "10000.00", numericText(t, s.PurchasesTotal), "the live purchases")
	assert.Equal(t, "2500.50", numericText(t, s.PaymentsTotal), "the live payments")
	assert.Equal(t, "7499.50", numericText(t, s.Balance), "what is owed")

	addPayment(t, pool, olma.ID, bozor.ID, nil, "10000", false)
	s, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "-2500.50", numericText(t, s.Balance), "an advance")

	nok := createCompany(t, q, "Nok", today(t, pool))
	_, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's")
	mustExec(t, pool, "UPDATE suppliers SET deleted_at = now() WHERE id = $1", bozor.ID)
	_, err = q.GetSupplier(ctx, gen.GetSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted")
}

func TestListSuppliers(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	for _, name := range []string{"Chorsu", "bozor", "Anhor"} {
		createSupplier(t, q, olma.ID, name)
	}
	createSupplier(t, q, nok.ID, "Begona")
	_, err := q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Dehqon", Phone: ptr("998909998877"), CreatedBy: enteredBy})
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE suppliers SET is_active = false WHERE company_id = $1 AND name = 'Anhor'", olma.ID)
	mustExec(t, pool, "UPDATE suppliers SET deleted_at = now() WHERE company_id = $1 AND name = 'Chorsu'", olma.ID)
	names := func(params gen.ListSuppliersParams) []string {
		rows, err := q.ListSuppliers(ctx, params)
		require.NoError(t, err)
		out := make([]string, 0, len(rows))
		for _, r := range rows {
			out = append(out, r.Name)
		}
		return out
	}
	active := gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Limit: 20}

	assert.Equal(t, []string{"bozor", "Dehqon"}, names(active), "the live active ones, by name whatever the case")
	assert.Equal(t, []string{"Anhor"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: false, Limit: 20}), "the inactive")
	assert.Equal(t, []string{"bozor"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Search: ptr("ZOR"), Limit: 20}), "searched by name, whatever the case")
	assert.Equal(t, []string{"Dehqon"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Digits: ptr("99988"), Limit: 20}), "searched by the digits of the phone")
	assert.Equal(t, []string{"Dehqon"}, names(gen.ListSuppliersParams{CompanyID: olma.ID, IsActive: true, Limit: 1, Offset: 1}), "paged")
	count, err := q.CountSuppliers(ctx, gen.CountSuppliersParams{CompanyID: olma.ID, IsActive: true})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	rows, err := q.ListSuppliers(ctx, active)
	require.NoError(t, err)
	assert.Equal(t, "0", numericText(t, rows[0].Balance), "each with its balance")
}

func TestUpdateSupplier(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	createSupplier(t, q, olma.ID, "Chorsu")

	s, err := q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: bozor.ID, CompanyID: olma.ID, Name: "Eski bozor", Phone: ptr("998901234567"), Note: nil})
	require.NoError(t, err)
	assert.Equal(t, "Eski bozor", s.Name)
	assert.Equal(t, ptr("998901234567"), s.Phone)
	assert.Nil(t, s.Note)
	assert.True(t, s.UpdatedAt.After(bozor.UpdatedAt))
	_, err = q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: bozor.ID, CompanyID: olma.ID, Name: "CHORSU"})
	assert.Equal(t, "23505", sqlState(err), "another's name")
	_, err = q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: 999999, CompanyID: olma.ID, Name: "X"})
	assert.ErrorIs(t, err, pgx.ErrNoRows)

	off, err := q.SetSupplierActive(ctx, gen.SetSupplierActiveParams{ID: bozor.ID, CompanyID: olma.ID, IsActive: false})
	require.NoError(t, err)
	assert.False(t, off.IsActive)

	_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: bozor.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.CreateSupplier(ctx, gen.CreateSupplierParams{CompanyID: olma.ID, Name: "Eski bozor", CreatedBy: enteredBy})
	assert.NoError(t, err, "the name is free again")
}

func TestASupplierInUseIsCounted(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	createUser(t, q, enteredBy, "Ali Valiyev")
	asosiy := addLocation(t, pool, olma.ID, "Asosiy")
	bozor := createSupplier(t, q, olma.ID, "Bozor")
	product := createProduct(t, q, olma.ID, "product", "Olma", ptr("kg"))
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 1, "1", "1", false)
	addPurchase(t, pool, olma.ID, asosiy, bozor.ID, product.ID, 2, "1", "1", true)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", false)
	addPayment(t, pool, olma.ID, bozor.ID, nil, "1", true)

	purchases, err := q.CountSupplierPurchases(ctx, bozor.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, purchases, "the deleted purchase not counted")
	payments, err := q.CountSupplierPayments(ctx, bozor.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, payments, "the deleted payment not counted")

	standing, err := q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: bozor.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.True(t, standing, "is_active")
	_, err = q.SupplierStanding(ctx, gen.SupplierStandingParams{ID: 999999, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}
