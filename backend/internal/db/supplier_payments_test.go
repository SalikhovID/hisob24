package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateGetAndListPayments(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 4, "1", "1", false)

	linked, err := q.CreatePayment(ctx, gen.CreatePaymentParams{
		CompanyID: w.company, SupplierID: w.bozor, PurchaseID: &purchase, Amount: numeric(t, "5000"), PaidOn: onDay(t, "2026-10-07"),
		CreatedBy: enteredBy, CreatedByName: ptr("Ali aka"),
	})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", numericText(t, linked.Amount))
	own, err := q.CreatePayment(ctx, gen.CreatePaymentParams{CompanyID: w.company, SupplierID: w.bozor, Amount: numeric(t, "1200.5"), PaidOn: onDay(t, "2026-10-09"), Note: ptr("Naqd"), CreatedBy: enteredBy})
	require.NoError(t, err)
	_, err = q.CreatePayment(ctx, gen.CreatePaymentParams{CompanyID: w.company, SupplierID: w.bozor, Amount: numeric(t, "0"), PaidOn: onDay(t, "2026-10-09"), CreatedBy: enteredBy})
	assert.Equal(t, "23514", sqlState(err), "an amount above zero")

	got, err := q.GetPayment(ctx, gen.GetPaymentParams{ID: linked.ID, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Equal(t, &purchase, got.PurchaseID)
	assert.Equal(t, ptr(int32(4)), got.PurchaseNumber, "the number of the purchase it was entered with")
	assert.Equal(t, ptr("Ali aka"), got.CreatedByName)
	got, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own.ID, SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.Nil(t, got.PurchaseID)
	assert.Nil(t, got.PurchaseNumber)
	assert.Equal(t, ptr("Naqd"), got.Note)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	_, err = q.GetPayment(ctx, gen.GetPaymentParams{ID: own.ID, SupplierID: dehqon, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another supplier's")

	rows, err := q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, own.ID, rows[0].ID, "the newest first")
	assert.Equal(t, linked.ID, rows[1].ID)
	count, err := q.CountPayments(ctx, gen.CountPaymentsParams{SupplierID: w.bozor, CompanyID: w.company})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	rows, err = q.ListPayments(ctx, gen.ListPaymentsParams{SupplierID: w.bozor, CompanyID: w.company, Limit: 1, Offset: 1})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, linked.ID, rows[0].ID, "paged")
}

func TestUpdateAndDeletePayment(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	own := addPayment(t, pool, w.company, w.bozor, nil, "1000", false)

	p, err := q.UpdatePayment(ctx, gen.UpdatePaymentParams{ID: own, CompanyID: w.company, Amount: numeric(t, "1500"), PaidOn: onDay(t, "2026-10-01"), Note: ptr("Karta")})
	require.NoError(t, err)
	assert.Equal(t, "1500.00", numericText(t, p.Amount))
	assert.Equal(t, onDay(t, "2026-10-01"), p.PaidOn)
	assert.Equal(t, ptr("Karta"), p.Note)

	_, err = q.DeletePayment(ctx, gen.DeletePaymentParams{ID: own, CompanyID: w.company})
	require.NoError(t, err)
	_, err = q.DeletePayment(ctx, gen.DeletePaymentParams{ID: own, CompanyID: w.company})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	_, err = q.UpdatePayment(ctx, gen.UpdatePaymentParams{ID: own, CompanyID: w.company, Amount: numeric(t, "1"), PaidOn: onDay(t, "2026-10-01")})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted payment is not edited")
}

func TestAPurchasesPaymentFollowsThePurchase(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	w := newWarehouse(t, q, pool)
	dehqon := createSupplier(t, q, w.company, "Dehqon").ID
	purchase := addPurchase(t, pool, w.company, w.asosiy, w.bozor, w.olma, 1, "1", "1", false)

	_, err := q.GetPurchasePayment(ctx, purchase)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "none yet")
	id := addPayment(t, pool, w.company, w.bozor, &purchase, "5000", false)
	p, err := q.GetPurchasePayment(ctx, purchase)
	require.NoError(t, err)
	assert.Equal(t, id, p.ID)

	require.NoError(t, q.UpdatePurchasePayment(ctx, gen.UpdatePurchasePaymentParams{PurchaseID: purchase, SupplierID: dehqon, Amount: numeric(t, "7000"), PaidOn: onDay(t, "2026-10-09")}))
	p, err = q.GetPurchasePayment(ctx, purchase)
	require.NoError(t, err)
	assert.Equal(t, dehqon, p.SupplierID, "it moves with the purchase to the other supplier")
	assert.Equal(t, "7000.00", numericText(t, p.Amount))
	assert.Equal(t, onDay(t, "2026-10-09"), p.PaidOn, "on the purchase's day")

	require.NoError(t, q.DeletePurchasePayment(ctx, purchase))
	_, err = q.GetPurchasePayment(ctx, purchase)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "hidden with the purchase")
	require.NoError(t, q.DeletePurchasePayment(ctx, purchase), "nothing to hide is fine")
}
