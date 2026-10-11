package currency

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali     = "998901111111"
	adminID = 461603558
)

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

// addCompany makes a company with Ali as its owner ("Ali aka") and the so'm
// on, the way company.Create leaves one, and returns its id.
func addCompany(t *testing.T, pool *pgxpool.Pool, name string) int64 {
	t.Helper()
	ctx := t.Context()
	var id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&id))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", ali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka')", ali, id)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1)", id)
	require.NoError(t, err)
	return id
}

// turnOn turns a currency on for the company, as the admin does.
func turnOn(t *testing.T, pool *pgxpool.Pool, companyID, currencyID int64) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, $2)", companyID, currencyID)
	require.NoError(t, err)
}

// addProduct enters a product priced in the currency and returns its id.
func addProduct(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, currencyID int64) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO products (company_id, kind, name, unit, price, currency_id, created_by) VALUES ($1, 'product', $2, 'kg', 10, $3, $4) RETURNING id",
		companyID, name, currencyID, ali).Scan(&id))
	return id
}

// codesOf is the codes of the company's currencies, in order.
func codesOf(rows []CompanyCurrency) []string {
	codes := []string{}
	for _, c := range rows {
		codes = append(codes, c.Code)
	}
	return codes
}

// refused checks that err is the API error of kind with the code and the message.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	require.ErrorAs(t, err, &e, about...)
	assert.Equal(t, kind, e.Kind, about...)
	assert.Equal(t, code, e.Code, about...)
	assert.Equal(t, message, e.Message, about...)
}

func TestCatalog(t *testing.T) {
	s, _ := newService(t)

	got, err := s.Catalog(t.Context())

	require.NoError(t, err)
	assert.Equal(t, []Currency{
		{ID: 1, Code: "UZS", Name: "O'zbek so'mi", Symbol: "so'm"},
		{ID: 2, Code: "USD", Name: "AQSH dollari", Symbol: "$"},
		{ID: 3, Code: "EUR", Name: "Yevro", Symbol: "€"},
		{ID: 4, Code: "RUB", Name: "Rossiya rubli", Symbol: "₽"},
	}, got)
}

func TestOfCompanyTellsTheRatesInForce(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")

	got, err := s.OfCompany(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []CompanyCurrency{{Currency: Currency{ID: 1, Code: "UZS", Name: "O'zbek so'mi", Symbol: "so'm"}, Rate: ptr("1.0000")}}, got, "the so'm alone, at 1")

	turnOn(t, pool, olma, 2)
	got, err = s.OfCompany(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD"}, codesOf(got))
	assert.Nil(t, got[1].Rate, "no rate set yet")

	_, err = s.SetRates(ctx, olma, ali, RatesInput{USD: ptr("12800")})
	require.NoError(t, err)
	got, err = s.OfCompany(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, ptr("12800.0000"), got[1].Rate, "the rate in force now")
}

func TestSetOfCompany(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")

	got, err := s.SetOfCompany(ctx, olma, []int64{3, 2, 2}, adminID)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD", "EUR"}, codesOf(got), "the so'm stays, the rest in the catalog's order, a duplicate counts once")

	got, err = s.SetOfCompany(ctx, olma, []int64{2}, adminID)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD"}, codesOf(got), "the euro is off again")

	got, err = s.SetOfCompany(ctx, olma, []int64{1, 2}, adminID)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD"}, codesOf(got), "naming the so'm changes nothing")

	_, err = s.SetOfCompany(ctx, olma, []int64{2, 9}, adminID)
	refused(t, err, apperr.Invalid, "validation_error", "Valyuta noto'g'ri")
	got, err = s.OfCompany(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"UZS", "USD"}, codesOf(got), "nothing changed")

	addProduct(t, pool, olma, "Olma", 2)
	addProduct(t, pool, olma, "Nok", 2)
	_, err = s.SetOfCompany(ctx, olma, nil, adminID)
	refused(t, err, apperr.Conflict, "currency_in_use", "Bu valyutada 2 ta mahsulot bor")
	_, err = pool.Exec(ctx, "UPDATE products SET deleted_at = now()")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Karta', 2)", olma)
	require.NoError(t, err)
	_, err = s.SetOfCompany(ctx, olma, nil, adminID)
	refused(t, err, apperr.Conflict, "currency_in_use", "Bu valyutada 1 ta akkaunt bor", "an account in the currency keeps it on too")

	_, err = s.SetOfCompany(ctx, olma+1000, []int64{2}, adminID)
	refused(t, err, apperr.NotFound, "not_found", "Kompaniya topilmadi")
}
