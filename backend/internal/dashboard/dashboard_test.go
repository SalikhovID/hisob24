package dashboard

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/order"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const ali = "998901111111"

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool, order.NewService(pool, customer.NewService(pool))), pool
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
// moves (0: none) and the one a transfer or a conversion moves it to with
// what arrives there (to, toTotal), the category of an expense or of other
// income, its currency and rate row (0: the shop's standard one) and its
// total; deleted hides it.
type doc struct {
	kind                                  string
	at                                    string
	location, supplier, customer, account int64
	order, category, to                   int64
	currency, rate                        int64
	total, toTotal                        string
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
	var toTotal *string
	if d.toTotal != "" {
		toTotal = &d.toTotal
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `
		INSERT INTO transactions (company_id, kind, number, doc_at, location_id, supplier_id, customer_id, bank_account_id, currency_id, currency_rate_id, total, created_by, deleted_at, order_id, category_id, to_bank_account_id, to_total)
		VALUES ($1, $2, (SELECT COALESCE(max(number), 0) + 1 FROM transactions WHERE company_id = $1 AND kind = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $12 THEN now() END, $13, $14, $15, $16)
		RETURNING id`,
		s.company, d.kind, d.at, none(d.location), none(d.supplier), none(d.customer), none(d.account), d.currency, d.rate, d.total, ali, d.deleted, none(d.order),
		none(d.category), none(d.to), toTotal).Scan(&id))
	return id
}

// addAccount enters an account of the company in the currency given;
// inactive turns it off, deleted hides it.
func addAccount(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, currencyID int64, inactive, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO bank_accounts (company_id, name, currency_id, is_active, deleted_at) VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() END) RETURNING id",
		companyID, name, currencyID, !inactive, deleted).Scan(&id))
	return id
}

// addCategory enters a finance category of the company: an expense or an
// income one.
func addCategory(t *testing.T, pool *pgxpool.Pool, companyID int64, kind string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO finance_categories (company_id, name, kind, position) VALUES ($1, $2, $2, 1) RETURNING id", companyID, kind).Scan(&id))
	return id
}

// today is the day the tests count from: 2026-10-13 in Tashkent.
var today = time.Date(2026, 10, 13, 0, 0, 0, 0, time.UTC)

// input is the dashboard asked for by a member who may do what is given,
// in every location of their scope, on today.
func input(perms ...access.Permission) Input {
	return Input{Permissions: access.NewSet(perms), Zone: "Asia/Tashkent", Today: today}
}

func TestCash(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	at := "2026-10-07T09:00:00+05:00"
	_, err := pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 3)", sh.company)
	require.NoError(t, err)
	xarajat := addCategory(t, pool, sh.company, "expense")
	kirim := addCategory(t, pool, sh.company, "income")
	bozor := addSupplier(t, pool, sh.company, "Bozor", true, false)
	mijoz := addCustomer(t, pool, sh.company, "998901234567", at, false)
	// Naqd (so'm): an opening of 1 000 000, other income of 250 000, an
	// expense of 100 000 and 200 000 sent to Karta; a deleted expense does
	// not count.
	sh.add(t, pool, doc{kind: "cash_opening", at: at, account: sh.cash, total: "1000000"})
	sh.add(t, pool, doc{kind: "income", at: at, account: sh.cash, category: kirim, total: "250000"})
	sh.add(t, pool, doc{kind: "expense", at: at, account: sh.cash, category: xarajat, total: "100000"})
	sh.add(t, pool, doc{kind: "expense", at: at, account: sh.cash, category: xarajat, total: "999999", deleted: true})
	// Karta (so'm, turned off): the 200 000 from Naqd and a customer's
	// payment of 50 000.
	karta := addAccount(t, pool, sh.company, "Karta", 1, true, false)
	sh.add(t, pool, doc{kind: "money_transfer", at: at, account: sh.cash, to: karta, total: "200000"})
	sh.add(t, pool, doc{kind: "customer_payment", at: at, account: karta, customer: mijoz, total: "50000"})
	// Dollar: an opening of 300 $, a supplier paid 120 $, 100 $ turned
	// into 1 300 000 so'm in Karta.
	dollar := addAccount(t, pool, sh.company, "Dollar", 2, false, false)
	sh.add(t, pool, doc{kind: "cash_opening", at: at, account: dollar, currency: 2, total: "300"})
	sh.add(t, pool, doc{kind: "supplier_payment", at: at, account: dollar, supplier: bozor, currency: 2, total: "120"})
	sh.add(t, pool, doc{kind: "conversion", at: at, account: dollar, to: karta, currency: 2, total: "100", toTotal: "1300000"})
	// Evro: what came went; it holds nothing.
	evro := addAccount(t, pool, sh.company, "Evro", 3, false, false)
	sh.add(t, pool, doc{kind: "cash_opening", at: at, account: evro, currency: 3, total: "40"})
	sh.add(t, pool, doc{kind: "expense", at: at, account: evro, category: xarajat, currency: 3, total: "40"})
	// A deleted account and another company's.
	eski := addAccount(t, pool, sh.company, "Eski", 1, false, true)
	sh.add(t, pool, doc{kind: "cash_opening", at: at, account: eski, total: "5000000"})
	nok := newShop(t, pool, "Nok")
	nok.add(t, pool, doc{kind: "cash_opening", at: at, account: nok.cash, total: "7000000"})

	got, err := s.Get(ctx, sh.scope(), input(access.FinanceView))

	require.NoError(t, err)
	assert.Equal(t, &Cash{
		Totals:   []CurrencyAmount{{CurrencyID: 1, Amount: "2500000.00"}, {CurrencyID: 2, Amount: "80.00"}},
		Accounts: 4,
	}, got.Cash, "Naqd's 950 000 and Karta's 1 550 000 in so'm, the 80 $; the euro that came to nothing is left out; the deleted account and another company's are out, the turned off one counts")

	none, err := s.Get(ctx, sh.scope(), input(access.OrdersView))
	require.NoError(t, err)
	assert.Nil(t, none.Cash, "without finance.view")
}

func TestDebtors(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	st := addStages(t, pool, sh.company)
	at := "2026-10-07T09:00:00+05:00"
	// Dilshod: a sale of 1 000 000 in Asosiy, 400 000 paid; a deleted sale
	// does not count.
	dilshod := addCustomer(t, pool, sh.company, "998901000001", at, false)
	sh.add(t, pool, doc{kind: "sale", at: at, location: sh.asosiy, customer: dilshod, total: "1000000"})
	sh.add(t, pool, doc{kind: "customer_payment", at: at, account: sh.cash, customer: dilshod, total: "400000"})
	sh.add(t, pool, doc{kind: "sale", at: at, location: sh.asosiy, customer: dilshod, total: "999999", deleted: true})
	// Malika: a sale of 50 $ in Chilonzor by the standard rate (640 000)
	// and an opening debt of 100 000.
	malika := addCustomer(t, pool, sh.company, "998901000002", at, false)
	sh.add(t, pool, doc{kind: "sale", at: at, location: sh.chilonzor, customer: malika, currency: 2, total: "50"})
	sh.add(t, pool, doc{kind: "customer_debt", at: at, customer: malika, total: "100000"})
	// Anor paid 300 000 ahead; Sardor's order of 10 $ by its own rate
	// (130 000) is paid in full.
	anor := addCustomer(t, pool, sh.company, "998901000003", at, false)
	sh.add(t, pool, doc{kind: "customer_prepay", at: at, customer: anor, total: "300000"})
	sardor := addCustomer(t, pool, sh.company, "998901000004", at, false)
	order := addOrder(t, pool, sh.company, st, st.yangi, sh.asosiy, sardor, "2026-10-20", false)
	sh.add(t, pool, doc{kind: "order", at: at, location: sh.asosiy, customer: sardor, order: order, currency: 2, rate: sh.ownRate, total: "10"})
	sh.add(t, pool, doc{kind: "customer_payment", at: at, account: sh.cash, customer: sardor, total: "130000"})
	// A deleted customer who owed, a customer with nothing and another
	// company's.
	eski := addCustomer(t, pool, sh.company, "998901000005", at, true)
	sh.add(t, pool, doc{kind: "customer_debt", at: at, customer: eski, total: "777000"})
	addCustomer(t, pool, sh.company, "998901000006", at, false)
	nok := newShop(t, pool, "Nok")
	begona := addCustomer(t, pool, nok.company, "998901000007", at, false)
	nok.add(t, pool, doc{kind: "customer_debt", at: at, customer: begona, total: "5000000"})

	got, err := s.Get(ctx, sh.scope(), input(access.CustomersView, access.SalesView))

	require.NoError(t, err)
	assert.Equal(t, &Debtors{Debt: "1340000.00", Count: 2},
		got.Debtors, "Dilshod's 600 000 and Malika's 740 000; the advance, the settled, the empty, the deleted and another company's are out")

	restricted, err := s.Get(ctx, sh.scope(sh.chilonzor), input(access.CustomersView, access.SalesView))
	require.NoError(t, err)
	assert.Equal(t, got.Debtors, restricted.Debtors, "a member of one location sees every customer's balance (logic/sales.md, section 6)")
	for about, perms := range map[string][]access.Permission{"the customers alone": {access.CustomersView}, "the sales alone": {access.SalesView}} {
		alone, err := s.Get(ctx, sh.scope(), input(perms...))
		require.NoError(t, err)
		assert.Nil(t, alone.Debtors, about+": the balances are the customer list's «Qarz», which wants both")
	}
}

// addProduct enters a product (or, with service, a service) of the
// company; inactive turns it off, deleted hides it.
func addProduct(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, service, inactive, deleted bool) int64 {
	t.Helper()
	kind := "product"
	if service {
		kind = "service"
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO products (company_id, kind, name, unit, is_active, created_by, deleted_at) VALUES ($1, $2, $3, CASE WHEN $2 = 'product' THEN 'dona' END, $4, $5, CASE WHEN $6 THEN now() END) RETURNING id",
		companyID, kind, name, !inactive, ali, deleted).Scan(&id))
	return id
}

// move enters a stock move of the document: the product's quantity in the
// location changes by qty.
func move(t *testing.T, pool *pgxpool.Pool, companyID, docID, locationID, productID int64, qty string) {
	t.Helper()
	_, err := pool.Exec(t.Context(), "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, $5)",
		docID, companyID, locationID, productID, qty)
	require.NoError(t, err)
}

func TestLowStock(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	at := "2026-10-07T09:00:00+05:00"
	bozor := addSupplier(t, pool, sh.company, "Bozor", true, false)
	inAsosiy := sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.asosiy, supplier: bozor, total: "1"})
	inChilonzor := sh.add(t, pool, doc{kind: "purchase", at: at, location: sh.chilonzor, supplier: bozor, total: "1"})
	stock := func(name string, asosiy, chilonzor string) {
		id := addProduct(t, pool, sh.company, name, false, false, false)
		if asosiy != "" {
			move(t, pool, sh.company, inAsosiy, sh.asosiy, id, asosiy)
		}
		if chilonzor != "" {
			move(t, pool, sh.company, inChilonzor, sh.chilonzor, id, chilonzor)
		}
	}
	// In Asosiy: 2, 3 (the edge), 4, 0 (all gone) and 1 of «arqon» (a small
	// letter: the names go by name whatever the case); Ip and Lenta 1 and 2.
	stock("Bolt", "2", "")
	stock("Gayka", "3", "")
	stock("Shayba", "4", "")
	vint := addProduct(t, pool, sh.company, "Vint", false, false, false)
	move(t, pool, sh.company, inAsosiy, sh.asosiy, vint, "5")
	move(t, pool, sh.company, inAsosiy, sh.asosiy, vint, "-5")
	stock("arqon", "1", "")
	stock("Ip", "1", "")
	stock("Lenta", "2", "")
	// Mix is Chilonzor's alone; Kabel has 1 in Asosiy and 10 in Chilonzor.
	stock("Mix", "", "1")
	stock("Kabel", "1", "10")
	// Out of it: a deleted product, a turned off one, one never moved, a
	// service and another company's.
	for _, p := range []struct {
		name                       string
		service, inactive, deleted bool
	}{{"Eski", false, false, true}, {"Nofaol", false, true, false}, {"Montaj", true, false, false}} {
		id := addProduct(t, pool, sh.company, p.name, p.service, p.inactive, p.deleted)
		move(t, pool, sh.company, inAsosiy, sh.asosiy, id, "1")
	}
	addProduct(t, pool, sh.company, "Yangi", false, false, false)
	nok := newShop(t, pool, "Nok")
	begona := addProduct(t, pool, nok.company, "Begona", false, false, false)
	nokSupplier := addSupplier(t, pool, nok.company, "Nok bozor", true, false)
	move(t, pool, nok.company, nok.add(t, pool, doc{kind: "purchase", at: at, location: nok.asosiy, supplier: nokSupplier, total: "1"}), nok.asosiy, begona, "1")

	got, err := s.Get(ctx, sh.scope(), input(access.StockView))

	require.NoError(t, err)
	assert.Equal(t, &LowStock{Count: 7, Names: []string{"arqon", "Bolt", "Gayka", "Ip", "Lenta"}}, got.LowStock,
		"every location of the scope, summed: Kabel's 11 is enough, Mix's 1 is low; the first five names by name")

	in := input(access.StockView)
	in.LocationID = sh.asosiy
	one, err := s.Get(ctx, sh.scope(), in)
	require.NoError(t, err)
	assert.Equal(t, &LowStock{Count: 7, Names: []string{"arqon", "Bolt", "Gayka", "Ip", "Kabel"}}, one.LowStock,
		"Asosiy's alone: Kabel's 1 is low there, Mix never moved there")

	none, err := s.Get(ctx, sh.scope(), input(access.ProductsView))
	require.NoError(t, err)
	assert.Nil(t, none.LowStock, "without stock.view")
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

// stages is a company's stages of the orders: Yangi, Jarayonda and the
// done Bajarildi, with an order type.
type stages struct{ yangi, jarayonda, bajarildi, buyurtma int64 }

func addStages(t *testing.T, pool *pgxpool.Pool, companyID int64) stages {
	t.Helper()
	ctx := t.Context()
	var st stages
	for _, s := range []struct {
		name string
		done bool
		into *int64
	}{{"Yangi", false, &st.yangi}, {"Jarayonda", false, &st.jarayonda}, {"Bajarildi", true, &st.bajarildi}} {
		require.NoError(t, pool.QueryRow(ctx,
			"INSERT INTO order_stages (company_id, name, color, is_done, position) VALUES ($1, $2, 'blue', $3, (SELECT count(*) + 1 FROM order_stages WHERE company_id = $1)) RETURNING id",
			companyID, s.name, s.done).Scan(s.into))
	}
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO order_types (company_id, name, position) VALUES ($1, 'Buyurtma', 1) RETURNING id", companyID).Scan(&st.buyurtma))
	return st
}

// addOrder enters an order of the company in the stage and the location, due
// on the day, for the customer; deleted hides it.
func addOrder(t *testing.T, pool *pgxpool.Pool, companyID int64, st stages, stageID, locationID, customerID int64, deadline string, deleted bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, number, deadline, created_by, deleted_at) VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(number), 0) + 1 FROM orders WHERE company_id = $1), $6, $7, CASE WHEN $8 THEN now() END) RETURNING id",
		companyID, st.buyurtma, stageID, customerID, locationID, deadline, ali, deleted).Scan(&id))
	return id
}

// The month's priced orders: their documents' prices in so'm, by each
// day's end, for whoever sees the orders; one priced at nothing, a hidden
// document and another company's are out.
func TestOrders(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	st := addStages(t, pool, sh.company)
	karim := addCustomer(t, pool, sh.company, "998900000001", "2026-09-20T12:00:00+05:00", false)
	addOrder(t, pool, sh.company, st, st.yangi, sh.asosiy, karim, "2026-10-10", false)
	addOrder(t, pool, sh.company, st, st.jarayonda, sh.asosiy, karim, "2026-10-13", false)
	addOrder(t, pool, sh.company, st, st.yangi, sh.asosiy, karim, "2026-10-14", false)
	addOrder(t, pool, sh.company, st, st.bajarildi, sh.asosiy, karim, "2026-10-01", false)
	addOrder(t, pool, sh.company, st, st.yangi, sh.asosiy, karim, "2026-10-01", true)
	addOrder(t, pool, sh.company, st, st.jarayonda, sh.chilonzor, karim, "2026-10-11", false)
	nok := newShop(t, pool, "Nok")
	nst := addStages(t, pool, nok.company)
	begona := addCustomer(t, pool, nok.company, "998900000002", "2026-09-20T12:00:00+05:00", false)
	addOrder(t, pool, nok.company, nst, nst.yangi, nok.asosiy, begona, "2026-10-01", false)

	numbers := func(orders []order.Order) []int32 {
		out := []int32{}
		for _, t := range orders {
			out = append(out, t.Number)
		}
		return out
	}
	for about, tc := range map[string]struct {
		scope    Scope
		location int64
		active   int64
		late     int64
		stages   []StageCount
		upcoming []int32
	}{
		"every location of the scope":  {sh.scope(), 0, 4, 2, []StageCount{{st.yangi, 2}, {st.jarayonda, 2}}, []int32{1, 6, 2, 3}},
		"one location":                 {sh.scope(), sh.asosiy, 3, 1, []StageCount{{st.yangi, 2}, {st.jarayonda, 1}}, []int32{1, 2, 3}},
		"a location outside the scope": {sh.scope(sh.asosiy), sh.chilonzor, 0, 0, []StageCount{{st.yangi, 0}, {st.jarayonda, 0}}, []int32{}},
		"a member with no location":    {sh.scope([]int64{}...), 0, 0, 0, []StageCount{{st.yangi, 0}, {st.jarayonda, 0}}, []int32{}},
	} {
		in := input(access.OrdersView)
		in.LocationID = tc.location
		got, err := s.Get(ctx, tc.scope, in)
		require.NoError(t, err, about)
		require.NotNil(t, got.Orders, about)
		assert.Equal(t, tc.active, got.Orders.Active, about+": not done yet; the done, the deleted and another company's are out")
		assert.Equal(t, tc.late, got.Orders.Late, about+": due before today")
		assert.Equal(t, tc.stages, got.Orders.ByStage, about+": each stage not done, in its order, the empty ones too")
		assert.Equal(t, tc.upcoming, numbers(got.Orders.Upcoming), about+": the soonest due first")
	}
}

// repeat is the value n times over.
func repeat(value string, n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = value
	}
	return out
}

func TestSales(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, pool, "Olma")
	// 01:00 on the 1st in Tashkent is still September in UTC.
	sh.add(t, pool, doc{kind: "sale", at: "2026-09-30T20:00:00Z", location: sh.asosiy, total: "100000"})
	sh.add(t, pool, doc{kind: "sale", at: "2026-09-30T12:00:00+05:00", location: sh.asosiy, total: "555555"})
	// 50 $ by the standard rate: 640 000.
	sh.add(t, pool, doc{kind: "sale", at: "2026-10-03T10:00:00+05:00", location: sh.asosiy, currency: 2, total: "50"})
	sh.add(t, pool, doc{kind: "sale", at: "2026-10-03T15:00:00+05:00", location: sh.chilonzor, total: "10000"})
	sh.add(t, pool, doc{kind: "sale", at: "2026-10-05T10:00:00+05:00", location: sh.asosiy, total: "999999", deleted: true})
	sh.add(t, pool, doc{kind: "sale", at: "2026-10-14T10:00:00+05:00", location: sh.asosiy, total: "888888"})
	// 20 $ by its own rate: 260 000.
	sh.add(t, pool, doc{kind: "sale", at: "2026-10-12T10:00:00+05:00", location: sh.asosiy, currency: 2, rate: sh.ownRate, total: "20"})
	nok := newShop(t, pool, "Nok")
	nok.add(t, pool, doc{kind: "sale", at: "2026-10-03T10:00:00+05:00", location: nok.asosiy, total: "7000000"})

	got, err := s.Get(ctx, sh.scope(), input(access.SalesView))

	require.NoError(t, err)
	assert.Equal(t, &Money{
		MonthTotal: "1010000.00", MonthCount: 4,
		ByDay: append(append([]string{"100000.00", "100000.00"}, repeat("750000.00", 9)...), "1010000.00", "1010000.00"),
	}, got.Sales, "this month's up to today, in so'm by each one's rate, by each day's end in the member's zone; September's, tomorrow's, the deleted and another company's are out")

	in := input(access.SalesView)
	in.LocationID = sh.asosiy
	one, err := s.Get(ctx, sh.scope(), in)
	require.NoError(t, err)
	assert.Equal(t, &Money{MonthTotal: "1000000.00", MonthCount: 3, ByDay: append(append([]string{"100000.00", "100000.00"}, repeat("740000.00", 9)...), "1000000.00", "1000000.00")}, one.Sales,
		"one location's")
}

func TestEachBlockIsItsPermissions(t *testing.T) {
	s, pool := newService(t)
	sh := newShop(t, pool, "Olma")
	addStages(t, pool, sh.company)

	for about, tc := range map[string]struct {
		perms                                  []access.Permission
		cash, debtors, orders, sales, lowStock bool
	}{
		"nothing to see":                  {nil, false, false, false, false, false},
		"the finance":                     {[]access.Permission{access.FinanceView}, true, false, false, false, false},
		"the customers and the sales":     {[]access.Permission{access.CustomersView, access.SalesView}, false, true, false, true, false},
		"the orders":                      {[]access.Permission{access.OrdersView}, false, false, true, false, false},
		"the stock":                       {[]access.Permission{access.StockView}, false, false, false, false, true},
		"the purchases and the suppliers": {[]access.Permission{access.PurchasesView, access.SuppliersView}, false, false, false, false, false},
		"everything":                      {access.All, true, true, true, true, true},
	} {
		got, err := s.Get(t.Context(), sh.scope(), input(tc.perms...))
		require.NoError(t, err, about)
		assert.Equal(t, tc.cash, got.Cash != nil, about+": cash")
		assert.Equal(t, tc.debtors, got.Debtors != nil, about+": debtors")
		assert.Equal(t, tc.orders, got.Orders != nil, about+": orders")
		assert.Equal(t, tc.sales, got.Sales != nil, about+": sales")
		assert.Equal(t, tc.lowStock, got.LowStock != nil, about+": low stock")
	}
}
