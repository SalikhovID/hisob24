package dashboard

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/task"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const ali = "998901111111"

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool, task.NewService(pool, customer.NewService(pool))), pool
}

// shop is a company with Ali (the owner), two locations, the so'm and the
// dollar turned on, its cash and two rate rows: the standard one (1 $ =
// 12 800 so'm) and a document's own (1 $ = 13 000 so'm).
type shop struct {
	company, asosiy, chilonzor, cash int64
	rate, ownRate                    int64
}

func newShop(t *testing.T, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	var s shop
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&s.company))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1) ON CONFLICT DO NOTHING", ali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka')", ali, s.company)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", s.company).Scan(&s.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", s.company).Scan(&s.chilonzor))
	_, err = pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1), ($1, 2)", s.company)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", s.company).Scan(&s.cash))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, set_by) VALUES ($1, 12800, $2) RETURNING id", s.company, ali).Scan(&s.rate))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, usd, status, set_by) VALUES ($1, 13000, 2, $2) RETURNING id", s.company, ali).Scan(&s.ownRate))
	return s
}

// scope is a member's reach in the shop: every location unless some are
// given.
func (s shop) scope(locations ...int64) Scope {
	if locations == nil {
		locations = []int64{s.asosiy, s.chilonzor}
	}
	return Scope{CompanyID: s.company, LocationIDs: locations}
}

// addSupplier enters a supplier of the company; deleted hides it.
func addSupplier(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, active, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO suppliers (company_id, name, is_active, created_by, deleted_at) VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END) RETURNING id",
		companyID, name, active, ali, deleted).Scan(&id))
	return id
}

// doc is a document of the ledger as the tests enter it: its kind, when
// (RFC 3339), where and whose (0: none), the account a money document
// moves (0: none), its currency and rate row (0: the shop's standard one)
// and its total; deleted hides it.
type doc struct {
	kind                                  string
	at                                    string
	location, supplier, customer, account int64
	currency, rate                        int64
	total                                 string
	deleted                               bool
}

// add enters the document into the shop's ledger under the next number of
// its kind.
func (s shop) add(t *testing.T, pool *pgxpool.Pool, d doc) int64 {
	t.Helper()
	if d.currency == 0 {
		d.currency = 1
	}
	if d.rate == 0 {
		d.rate = s.rate
	}
	none := func(id int64) *int64 {
		if id == 0 {
			return nil
		}
		return &id
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `
		INSERT INTO transactions (company_id, kind, number, doc_at, location_id, supplier_id, customer_id, bank_account_id, currency_id, currency_rate_id, total, created_by, deleted_at)
		VALUES ($1, $2, (SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $12 THEN now() END)
		RETURNING id`,
		s.company, d.kind, d.at, none(d.location), none(d.supplier), none(d.customer), none(d.account), d.currency, d.rate, d.total, ali, d.deleted).Scan(&id))
	return id
}

// today is the day the tests count from: 2026-10-13 in Tashkent.
var today = time.Date(2026, 10, 13, 0, 0, 0, 0, time.UTC)

// input is the dashboard asked for by a member who may do what is given,
// in every location of their scope, on today.
func input(perms ...access.Permission) Input {
	return Input{Permissions: access.NewSet(perms), Zone: "Asia/Tashkent", Today: today}
}

func TestSuppliers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	at := "2026-10-07T09:00:00+05:00"
	// Bozor: 1 000 000 so'm and 100 $ by the standard rate (1 280 000)
	// bought, 500 000 paid; a deleted purchase does not count.
	bozor := addSupplier(t, pool, sh.company, "Bozor", true, false)
	sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.asosiy, supplier: bozor, total: "1000000"})
	sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.chilonzor, supplier: bozor, currency: 2, total: "100"})
	sh.add(t, pool, doc{kind: "supplier_payment", at: at, supplier: bozor, account: sh.cash, total: "500000"})
	sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.asosiy, supplier: bozor, total: "999999", deleted: true})
	// Uzum: an opening debt of 50 $ by its own rate (650 000).
	uzum := addSupplier(t, pool, sh.company, "Uzum", true, false)
	sh.add(t, pool, doc{kind: "supplier_debt", at: at, supplier: uzum, currency: 2, rate: sh.ownRate, total: "50"})
	// Ombor, turned off: paid 300 000 ahead.
	ombor := addSupplier(t, pool, sh.company, "Ombor", false, false)
	sh.add(t, pool, doc{kind: "supplier_prepay", at: at, supplier: ombor, total: "300000"})
	// Dehqon: bought and paid in full.
	dehqon := addSupplier(t, pool, sh.company, "Dehqon", true, false)
	sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.chilonzor, supplier: dehqon, total: "200000"})
	sh.add(t, pool, doc{kind: "supplier_payment", at: at, supplier: dehqon, account: sh.cash, total: "200000"})
	// A supplier with nothing, a deleted one and another company's.
	addSupplier(t, pool, sh.company, "Yangi", true, false)
	eski := addSupplier(t, pool, sh.company, "Eski", true, true)
	sh.add(t, pool, doc{kind: "supplier_debt", at: at, supplier: eski, total: "777000"})
	nok := newShop(t, pool, "Nok")
	begona := addSupplier(t, pool, nok.company, "Begona", true, false)
	nok.add(t, pool, doc{kind: "purchase", at: at, location: nok.asosiy, supplier: begona, total: "5000000"})

	got, err := s.Get(ctx, sh.scope(), input(access.PurchasesView))

	require.NoError(t, err)
	assert.Equal(t, &Suppliers{Debt: "2430000.00", Debtors: 2, Advance: "300000.00"}, got.Suppliers,
		"Bozor's 1 780 000 and Uzum's 650 000 owed, Ombor's 300 000 ahead; the settled, the empty, the deleted and another company's are out")

	restricted, err := s.Get(ctx, sh.scope(sh.asosiy), input(access.PurchasesView))
	require.NoError(t, err)
	assert.Equal(t, got.Suppliers, restricted.Suppliers, "a member of one location sees every supplier's balance (logic/locations.md)")
}

// addCustomer enters a customer of the company on the moment given (RFC
// 3339); deleted hides it.
func addCustomer(t *testing.T, pool *pgxpool.Pool, companyID int64, phone, at string, deleted bool) int64 {
	t.Helper()
	ctx := t.Context()
	var typeID int64
	if err := pool.QueryRow(ctx, "SELECT id FROM customer_types WHERE company_id = $1 ORDER BY id LIMIT 1", companyID).Scan(&typeID); err != nil {
		require.NoError(t, pool.QueryRow(ctx, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", companyID).Scan(&typeID))
	}
	var id int64
	require.NoError(t, pool.QueryRow(ctx,
		"INSERT INTO customers (company_id, type_id, phone, created_by, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() END) RETURNING id",
		companyID, typeID, phone, ali, at, deleted).Scan(&id))
	return id
}

func TestCustomers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	addCustomer(t, pool, sh.company, "998900000001", "2026-09-20T12:00:00+05:00", false)
	// 01:30 on the 1st in Tashkent is still September in UTC: the member's
	// zone says which day it is.
	addCustomer(t, pool, sh.company, "998900000002", "2026-09-30T20:30:00Z", false)
	addCustomer(t, pool, sh.company, "998900000003", "2026-10-01T18:00:00+05:00", false)
	addCustomer(t, pool, sh.company, "998900000004", "2026-10-05T12:00:00+05:00", false)
	addCustomer(t, pool, sh.company, "998900000005", "2026-10-03T12:00:00+05:00", true)
	nok := newShop(t, pool, "Nok")
	addCustomer(t, pool, nok.company, "998900000006", "2026-10-02T12:00:00+05:00", false)

	got, err := s.Get(ctx, sh.scope(), input(access.CustomersView))

	require.NoError(t, err)
	assert.Equal(t, &Customers{Total: 4, AddedThisMonth: 3, ByDay: []int64{3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4}}, got.Customers,
		"by each day's end of the month up to today: the one of September, two on the 1st, one on the 5th; the deleted and another company's are out")
}
