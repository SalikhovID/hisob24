package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestBankAccounts(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	cash, err := q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Naqd", CurrencyID: 1})
	require.NoError(t, err)
	assert.True(t, cash.IsActive, "active from the start")
	assert.Nil(t, cash.CreatedBy, "the migration's seed names no admin")
	card, err := q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Karta", CurrencyID: 2, CreatedBy: ptr(ownerID)})
	require.NoError(t, err)
	assert.Equal(t, ptr(ownerID), card.CreatedBy)
	_, err = q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "karta", CurrencyID: 1})
	assert.Equal(t, "23505", sqlState(err), "a name is one account's, whatever the case")
	_, err = q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: nok.ID, Name: "Karta", CurrencyID: 1})
	require.NoError(t, err, "another company has its own names")

	rows, err := q.ListBankAccounts(ctx, olma.ID)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, []int64{cash.ID, card.ID}, []int64{rows[0].ID, rows[1].ID}, "in the order added")

	got, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: card.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Karta", got.Name)
	_, err = q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: card.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's account")

	off, err := q.UpdateBankAccount(ctx, gen.UpdateBankAccountParams{ID: card.ID, CompanyID: olma.ID, IsActive: ptr(false)})
	require.NoError(t, err)
	assert.False(t, off.IsActive)
	assert.Equal(t, "Karta", off.Name, "what is not given stays")
	assert.EqualValues(t, 2, off.CurrencyID)
	renamed, err := q.UpdateBankAccount(ctx, gen.UpdateBankAccountParams{ID: card.ID, CompanyID: olma.ID, Name: ptr("Humo"), CurrencyID: ptr(int64(1))})
	require.NoError(t, err)
	assert.Equal(t, "Humo", renamed.Name)
	assert.EqualValues(t, 1, renamed.CurrencyID)
	assert.False(t, renamed.IsActive)
	assert.False(t, renamed.UpdatedAt.Before(card.UpdatedAt))
	_, err = q.UpdateBankAccount(ctx, gen.UpdateBankAccountParams{ID: card.ID, CompanyID: olma.ID, Name: ptr("naqd")})
	assert.Equal(t, "23505", sqlState(err))

	active, err := q.CountActiveBankAccounts(ctx, olma.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 1, active, "the cash alone is active")

	_, err = q.DeleteBankAccount(ctx, gen.DeleteBankAccountParams{ID: card.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	_, err = q.DeleteBankAccount(ctx, gen.DeleteBankAccountParams{ID: card.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
	rows, err = q.ListBankAccounts(ctx, olma.ID)
	require.NoError(t, err)
	assert.Len(t, rows, 1, "the deleted one is gone from the list")
	_, err = q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Humo", CurrencyID: 1})
	require.NoError(t, err, "a deleted account's name is free again")
}

func TestCountCurrencyBankAccounts(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	_, err := q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Naqd", CurrencyID: 1})
	require.NoError(t, err)
	card, err := q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)
	_, err = q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: olma.ID, Name: "Valyuta", CurrencyID: 2})
	require.NoError(t, err)

	n, err := q.CountCurrencyBankAccounts(ctx, gen.CountCurrencyBankAccountsParams{CompanyID: olma.ID, CurrencyID: 2})
	require.NoError(t, err)
	assert.EqualValues(t, 2, n)
	_, err = q.DeleteBankAccount(ctx, gen.DeleteBankAccountParams{ID: card.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	n, err = q.CountCurrencyBankAccounts(ctx, gen.CountCurrencyBankAccountsParams{CompanyID: olma.ID, CurrencyID: 2})
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "the live ones")
}
