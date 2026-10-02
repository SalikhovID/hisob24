package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateBilling(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	d := today(t, pool)
	c := createCompany(t, q, "Olma", d)
	var amount pgtype.Numeric
	require.NoError(t, amount.Scan("150000.50"))

	b, err := q.CreateBilling(ctx, gen.CreateBillingParams{
		CompanyID: c.ID, Days: 30, Amount: amount, PrevEndDate: d, NewEndDate: d.AddDate(0, 0, 30),
		Note: ptr("Naqd"), CreatedBy: ptr(ownerID),
	})
	require.NoError(t, err)
	assert.NotZero(t, b.ID)
	assert.Equal(t, int32(30), b.Days)
	got, err := b.Amount.Float64Value()
	require.NoError(t, err)
	assert.InDelta(t, 150000.50, got.Float64, 0.001)
	assert.True(t, b.NewEndDate.Equal(d.AddDate(0, 0, 30)))
	assert.Equal(t, "Naqd", *b.Note)

	noAmount, err := q.CreateBilling(ctx, gen.CreateBillingParams{CompanyID: c.ID, Days: 1, PrevEndDate: d, NewEndDate: d.AddDate(0, 0, 1)})
	require.NoError(t, err)
	assert.False(t, noAmount.Amount.Valid, "amount is optional")

	_, err = q.CreateBilling(ctx, gen.CreateBillingParams{CompanyID: c.ID, Days: 0, PrevEndDate: d, NewEndDate: d})
	assert.Equal(t, "23514", sqlState(err), "days must be positive") // check_violation
}
