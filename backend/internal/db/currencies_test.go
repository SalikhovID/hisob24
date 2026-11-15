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

// The night's run writes a standard row with no member, saying where its
// rates came from (logic/currencies.md, section 4).
func TestCreateAutoRate(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))

	row, err := q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12000"), Eur: rateOf(t, "13300"), Rub: rateOf(t, "146.19"), Source: "cbu"})

	require.NoError(t, err)
	assert.EqualValues(t, 1, row.Status, "a standard row")
	assert.Nil(t, row.SetBy, "no member")
	assert.Equal(t, ptr("cbu"), row.Source)
	assert.Equal(t, "12000.0000", numericText(t, row.Usd))
	assert.Equal(t, "13300.0000", numericText(t, row.Eur))
	assert.Equal(t, "146.1900", numericText(t, row.Rub))
}

// The history says where each row came from: a member's has no source,
// the night's run's has no member.
func TestListRatesSaysWhereARowCameFrom(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	zero := rateOf(t, "0")
	member, err := q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12800"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567"})
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE currency_rates SET set_at = now() - interval '1 day' WHERE id = $1", member.ID)
	auto, err := q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12000"), Eur: zero, Rub: zero, Source: "cbu"})
	require.NoError(t, err)

	rows, err := q.ListRates(ctx, gen.ListRatesParams{CompanyID: olma.ID, Limit: 20, Offset: 0})

	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, auto.ID, rows[0].ID)
	assert.Equal(t, ptr("cbu"), rows[0].Source, "the night's, from the central bank")
	assert.Nil(t, rows[0].SetByName, "no member")
	assert.Equal(t, member.ID, rows[1].ID)
	assert.Nil(t, rows[1].Source, "a member's")
	assert.Equal(t, ptr("Ali"), rows[1].SetByName)
}

// Whether the company has a standard row set since a moment: what keeps the
// night's run from writing a day's row twice, a member's row counted, a
// document's own not.
func TestHasStandardRateSince(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	addMember(t, q, olma.ID, "998901234567", "Ali", "owner")
	zero := rateOf(t, "0")
	since := time.Now().Add(-time.Hour)
	has := func(company int64) bool {
		t.Helper()
		yes, err := q.HasStandardRateSince(ctx, gen.HasStandardRateSinceParams{CompanyID: company, Since: since})
		require.NoError(t, err)
		return yes
	}

	assert.False(t, has(olma.ID), "no row at all")
	old, err := q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: olma.ID, Usd: zero, Eur: zero, Rub: zero, Source: "cbu"})
	require.NoError(t, err)
	mustExec(t, pool, "UPDATE currency_rates SET set_at = $2 WHERE id = $1", old.ID, since.Add(-time.Second))
	assert.False(t, has(olma.ID), "a row set before")
	_, err = q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: zero, Eur: zero, Rub: zero, Status: 2, SetBy: "998901234567"})
	require.NoError(t, err)
	assert.False(t, has(olma.ID), "a document's own row")
	_, err = q.CreateAutoRate(ctx, gen.CreateAutoRateParams{CompanyID: nok.ID, Usd: zero, Eur: zero, Rub: zero, Source: "cbu"})
	require.NoError(t, err)
	assert.False(t, has(olma.ID), "another company's row")
	_, err = q.CreateRate(ctx, gen.CreateRateParams{CompanyID: olma.ID, Usd: rateOf(t, "12800"), Eur: zero, Rub: zero, Status: 1, SetBy: "998901234567"})
	require.NoError(t, err)
	assert.True(t, has(olma.ID), "a member's standard row since")
	assert.True(t, has(nok.ID), "the night's row since")
}

// The night's run goes through every company with the source and the step
// it takes its rates by.
func TestListRateSources(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	mustExec(t, pool, "UPDATE companies SET rate_source = 'manual', rate_rounding = 1000, is_active = false WHERE id = $1", nok.ID)

	rows, err := q.ListRateSources(ctx)

	require.NoError(t, err)
	assert.Equal(t, []gen.ListRateSourcesRow{
		{ID: olma.ID, RateSource: "cbu", RateRounding: 100},
		{ID: nok.ID, RateSource: "manual", RateRounding: 1000},
	}, rows, "every company, the inactive too, in the order made")
}

// A company's rate source and step, read and set as the admin does.
func TestRateSource(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))

	got, err := q.GetRateSource(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, gen.GetRateSourceRow{RateSource: "cbu", RateRounding: 100}, got, "the central bank, to 100")

	set, err := q.SetRateSource(ctx, gen.SetRateSourceParams{ID: olma.ID, RateSource: "kapitalbank", RateRounding: 1000})
	require.NoError(t, err)
	assert.Equal(t, gen.SetRateSourceRow{RateSource: "kapitalbank", RateRounding: 1000}, set)
	got, err = q.GetRateSource(ctx, olma.ID)
	require.NoError(t, err)
	assert.Equal(t, gen.GetRateSourceRow{RateSource: "kapitalbank", RateRounding: 1000}, got)

	_, err = q.GetRateSource(ctx, olma.ID+1000)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "no such company")
	_, err = q.SetRateSource(ctx, gen.SetRateSourceParams{ID: olma.ID + 1000, RateSource: "cbu", RateRounding: 100})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "no such company")
}
