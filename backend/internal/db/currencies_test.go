package db_test

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// codesOf is the codes of the currencies, in the order given.
func codesOf(rows []gen.Currency) []string {
	codes := []string{}
	for _, c := range rows {
		codes = append(codes, c.Code)
	}
	return codes
}

func TestListCurrencies(t *testing.T) {
	q, _ := setup(t)

	rows, err := q.ListCurrencies(t.Context())

	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD", "EUR", "RUB"}, codesOf(rows), "the so'm first")
	usd, err := q.GetCurrency(t.Context(), 2)
	require.NoError(t, err)
	assert.Equal(t, gen.Currency{ID: 2, Code: "USD", Name: "AQSH dollari", Symbol: "$", Position: 2}, usd)
	_, err = q.GetCurrency(t.Context(), 9)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "not of the catalog")
}

func TestCompanyCurrencies(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	mustExec(t, pool, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1)", olma.ID)

	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 3, AddedBy: ptr(ownerID)}))
	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 2, AddedBy: ptr(ownerID)}))
	require.NoError(t, q.AddCompanyCurrency(ctx, gen.AddCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 2, AddedBy: ptr(ownerID)}), "twice is once")

	rows, err := q.ListCompanyCurrencies(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD", "EUR"}, codesOf(rows), "the catalog's order, whatever the order they were turned on in")
	has, err := q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: olma.ID, CurrencyID: 2})
	require.NoError(t, err)
	assert.True(t, has)
	has, err = q.CompanyHasCurrency(ctx, gen.CompanyHasCurrencyParams{CompanyID: olma.ID, CurrencyID: 4})
	require.NoError(t, err)
	assert.False(t, has, "the ruble is off")

	require.NoError(t, q.RemoveCompanyCurrency(ctx, gen.RemoveCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 3}))
	rows, err = q.ListCompanyCurrencies(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD"}, codesOf(rows))
	require.NoError(t, q.RemoveCompanyCurrency(ctx, gen.RemoveCompanyCurrencyParams{CompanyID: olma.ID, CurrencyID: 3}), "turning off what is off is nothing")
}

func TestCountCurrencyProducts(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	createUser(t, q, enteredBy, "Ali")
	mustExec(t, pool, `INSERT INTO products (company_id, kind, name, unit, currency_id, created_by, deleted_at) VALUES
		($1, 'product', 'Olma', 'kg', 2, $3, NULL), ($1, 'service', 'Yetkazish', NULL, 2, $3, NULL),
		($1, 'product', 'Nok', 'kg', 2, $3, now()), ($1, 'product', 'Behi', 'kg', 1, $3, NULL),
		($2, 'product', 'Anor', 'kg', 2, $3, NULL)`, olma.ID, nok.ID, enteredBy)

	n, err := q.CountCurrencyProducts(t.Context(), gen.CountCurrencyProductsParams{CompanyID: olma.ID, CurrencyID: 2})

	require.NoError(t, err)
	assert.EqualValues(t, 2, n, "the company's live products and services priced in the currency")
}

// rateOf is a rate as the queries take it.
func rateOf(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	var n pgtype.Numeric
	require.NoError(t, n.Scan(s))
	return n
}

func TestRates(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	zero := rateOf(t, "0")

	first, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12700"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567"})
	require.NoError(t, err)
	assert.Equal(t, "1.0000", numericText(t, first.Uzs), "the so'm is the base")
	assert.Equal(t, "12700.0000", numericText(t, first.Usd))
	mustExec(t, pool, "UPDATE currency_rates SET set_at = now() - interval '2 days' WHERE id = $1", first.ID)
	second, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12800"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567", SetByName: ptr("Ali aka")})
	require.NoError(t, err)
	custom, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: rateOf(t, "13000"), Eur: zero, Rub: zero, Status: 2, SetBy: "998901234567"})
	require.NoError(t, err)
	assert.EqualValues(t, 2, custom.Status, "a document's own rate")

	now, err := q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, At: time.Now().Add(time.Minute)})
	require.NoError(t, err)
	assert.Equal(t, second.ID, now.ID, "the newest standard row, not a document's own")
	then, err := q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, At: time.Now().Add(-24 * time.Hour)})
	require.NoError(t, err)
	assert.Equal(t, first.ID, then.ID, "the row in force a day ago")
	_, err = q.GetRateAt(ctx, gen.GetRateAtParams{CompanyID: olma.ID, At: time.Now().Add(-72 * time.Hour)})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "before any rate")
	earliest, err := q.GetFirstRate(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, first.ID, earliest.ID)

	rows, err := q.ListRates(ctx, gen.ListRatesParams{CompanyID: olma.ID, Limit: 20, Offset: 0})
	require.NoError(t, err)
	require.Len(t, rows, 2, "the standard rows alone, the newest first")
	assert.Equal(t, second.ID, rows[0].ID)
	assert.Equal(t, "Ali", *rows[0].SetByName, "the name the member goes by now")
	assert.Equal(t, first.ID, rows[1].ID)
	mustExec(t, pool, "DELETE FROM user_companies WHERE user_phone = '998901234567'")
	rows, err = q.ListRates(ctx, gen.ListRatesParams{CompanyID: olma.ID, Limit: 1, Offset: 0})
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "Ali aka", *rows[0].SetByName, "the name of then once they have left")
	total, err := q.CountRates(ctx, olma.ID)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
}
