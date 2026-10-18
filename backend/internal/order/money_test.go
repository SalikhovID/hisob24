package order

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
	"github.com/SalikhovID/hisob24/backend/internal/warehouse"
)

// stockedShop is a shop with its cash, a supplier, the products Olma (kg)
// and Nok (dona), and 10 Olma and 5 Nok in Asosiy by a purchase.
type stockedShop struct {
	shop
	cash, olma, nok int64
}

func stock(t *testing.T, pool *pgxpool.Pool, sh shop) stockedShop {
	t.Helper()
	ctx := t.Context()
	s := stockedShop{shop: sh}
	_, err := pool.Exec(ctx, "INSERT INTO company_currencies (company_id, currency_id) VALUES ($1, 1) ON CONFLICT DO NOTHING", sh.id)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO bank_accounts (company_id, name, currency_id) VALUES ($1, 'Naqd', 1) RETURNING id", sh.id).Scan(&s.cash))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Olma', 'kg', $2) RETURNING id", sh.id, owner).Scan(&s.olma))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO products (company_id, kind, name, unit, created_by) VALUES ($1, 'product', 'Nok', 'dona', $2) RETURNING id", sh.id, owner).Scan(&s.nok))
	var bozor, rate, purchase int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, 'Bozor', $2) RETURNING id", sh.id, owner).Scan(&bozor))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO currency_rates (company_id, status, set_by) VALUES ($1, 2, $2) RETURNING id", sh.id, owner).Scan(&rate))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, location_id, supplier_id, currency_rate_id, total, created_by)
		VALUES ($1, 'purchase', 1, '2026-10-01 09:00+05', $2, $3, $4, 20000, $5) RETURNING id`, sh.id, sh.asosiy, bozor, rate, owner).Scan(&purchase))
	_, err = pool.Exec(ctx, "INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position) VALUES ($1, $2, 10, 1000, 1), ($1, $3, 5, 2000, 2)", purchase, s.olma, s.nok)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity) VALUES ($1, $2, $3, $4, 10), ($1, $2, $3, $5, 5)", purchase, sh.id, sh.asosiy, s.olma, s.nok)
	require.NoError(t, err)
	return s
}

// stockOf is the product's stock in the location.
func stockOf(t *testing.T, pool *pgxpool.Pool, locationID, productID int64) string {
	t.Helper()
	var s string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT COALESCE(sum(quantity), 0)::numeric(14,3)::text FROM stock_moves WHERE location_id = $1 AND product_id = $2", locationID, productID).Scan(&s))
	return s
}

// documentsOf is the order's live journal: its document and the payments
// linked to it, as "kind:total".
func documentsOf(t *testing.T, pool *pgxpool.Pool, orderID int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT t.kind || ':' || t.total::text FROM transactions t
		WHERE (t.order_id = $1 OR t.linked_id IN (SELECT id FROM transactions WHERE order_id = $1)) AND t.deleted_at IS NULL ORDER BY t.id`, orderID)
	require.NoError(t, err)
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		require.NoError(t, rows.Scan(&s))
		out = append(out, s)
	}
	return out
}

func moneyOf(amount string, items []warehouse.ItemInput, payments ...ledger.PaymentLine) warehouse.OrderMoneyInput {
	return warehouse.OrderMoneyInput{Amount: ptr(amount), Items: items, Payments: payments}
}

func take(productID int64, quantity string) warehouse.ItemInput {
	return warehouse.ItemInput{ProductID: productID, Quantity: ptr(quantity)}
}

// An order entered with a price, a product and an advance: the money is
// the order's, the product leaves the stock, the advance is the customer's
// payment, and the history says nothing of it (logic/orders.md, 4.3).
func TestCreateWithMoney(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := stock(t, pool, newShop(t, s, pool, "Olma"))
	in := sh.input(t, "Montaj", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	in.Money = moneyOf("5000", []warehouse.ItemInput{take(sh.olma, "2")}, ledger.PaymentLine{BankAccountID: sh.cash, Amount: ptr("400")})

	order, err := s.Create(ctx, sh.scope(), owner, sh.buyurtma.ID, sh.asosiy, in, sh.existing())

	require.NoError(t, err)
	assert.Equal(t, "5000.00", order.Amount)
	assert.EqualValues(t, 1, order.CurrencyID)
	assert.Equal(t, "1.0000", order.Rate)
	assert.Equal(t, "5000.00", order.AmountUZS)
	assert.Equal(t, "400.00", order.Paid)
	detail, err := s.Detail(ctx, sh.scope(), order.ID)
	require.NoError(t, err)
	assert.Equal(t, order, detail.Order)
	assert.Equal(t, []warehouse.OrderLine{{ProductID: sh.olma, Name: "Olma", Kind: "product", Unit: ptr("kg"), Quantity: "2.000"}}, detail.Items)
	require.Len(t, detail.Payments, 1)
	assert.Equal(t, "400.00", detail.Payments[0].Amount)
	assert.Equal(t, "Naqd", detail.Payments[0].AccountName)
	assert.Nil(t, detail.CostUZS, "the cost is not asked for")
	assert.Nil(t, detail.ProfitUZS)
	assert.Equal(t, "8.000", stockOf(t, pool, sh.asosiy, sh.olma), "out of the stock")
	assert.Equal(t, []string{"order:5000.00", "customer_payment:400.00"}, documentsOf(t, pool, order.ID))
	assert.Equal(t, []string{"created by 998901111111 (Egamberdi Egasi): []"}, storedHistory(t, pool, order.ID))

	bare := mustOrder(t, s, sh.shop, "Qo'ng'iroq", "2026-10-11", map[int64]any{sh.izoh.ID: "Kech"})
	assert.Equal(t, "0.00", bare.Amount, "no money: nothing")
	assert.Equal(t, "0.00", bare.Paid)
	assert.Empty(t, documentsOf(t, pool, bare.ID), "and no document")
	page, err := s.List(ctx, sh.scope(), ListInput{Page: 1})
	require.NoError(t, err)
	assert.Equal(t, "5000.00", page.Items[0].Amount, "the list carries the money")
}

// The money is told after the customer: the price, the lines, the advance,
// then the stock; a refusal enters nothing.
func TestCreateRefusesBadMoneyAfterTheCustomer(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := stock(t, pool, newShop(t, s, pool, "Olma"))
	ok := sh.input(t, "Montaj", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	for _, tt := range []struct {
		name    string
		money   warehouse.OrderMoneyInput
		cust    CustomerInput
		kind    apperr.Kind
		code    string
		message string
	}{
		{"a bad price", moneyOf("5 000", nil), sh.existing(), apperr.Invalid, "validation_error", "Narx noto'g'ri"},
		{"the customer before the price", moneyOf("5 000", nil), CustomerInput{}, apperr.Invalid, "validation_error", "Mijozni tanlang"},
		{"a line of nothing", moneyOf("", []warehouse.ItemInput{take(0, "1")}), sh.existing(), apperr.Invalid, "validation_error", "Mahsulotni tanlang"},
		{"an advance of nothing", moneyOf("", nil, ledger.PaymentLine{BankAccountID: sh.cash, Amount: ptr("0")}), sh.existing(), apperr.Invalid, "validation_error", "To'lov summasi noto'g'ri"},
		{"more than the stock", moneyOf("", []warehouse.ItemInput{take(sh.olma, "11")}), sh.existing(), apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q"},
	} {
		in := ok
		in.Money = tt.money
		_, err := s.Create(ctx, sh.scope(), owner, sh.buyurtma.ID, sh.asosiy, in, tt.cust)
		refused(t, err, tt.kind, tt.code, tt.message, tt.name)
	}
	assert.Zero(t, count(t, pool, "SELECT count(*) FROM orders"), "nothing is entered")
	assert.Zero(t, count(t, pool, "SELECT count(*) FROM transactions WHERE kind <> 'purchase'"))
	assert.Equal(t, "10.000", stockOf(t, pool, sh.asosiy, sh.olma))
}

// An edit replaces the price and the lines and writes what changed to the
// history; the payments are left alone; an edit that changes nothing
// writes nothing.
func TestUpdateMoney(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := stock(t, pool, newShop(t, s, pool, "Olma"))
	in := sh.input(t, "Montaj", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	in.Money = moneyOf("5000", []warehouse.ItemInput{take(sh.olma, "2")}, ledger.PaymentLine{BankAccountID: sh.cash, Amount: ptr("400")})
	order, err := s.Create(ctx, sh.scope(), owner, sh.buyurtma.ID, sh.asosiy, in, sh.existing())
	require.NoError(t, err)
	same := Input{Title: "Montaj", Deadline: "2026-10-10", StageID: sh.yangi.ID, Values: in.Values}

	edited := same
	edited.Money = moneyOf("6000", []warehouse.ItemInput{take(sh.nok, "1")}, ledger.PaymentLine{BankAccountID: sh.cash, Amount: ptr("999")})
	got, err := s.Update(ctx, sh.scope(), order.ID, staff, edited)

	require.NoError(t, err)
	assert.Equal(t, "6000.00", got.Amount)
	assert.Equal(t, "400.00", got.Paid, "the advance stays: an edit leaves the payments alone")
	assert.Equal(t, "10.000", stockOf(t, pool, sh.asosiy, sh.olma), "the old line's product is back")
	assert.Equal(t, "4.000", stockOf(t, pool, sh.asosiy, sh.nok))
	assert.Equal(t, []string{
		"created by 998901111111 (Egamberdi Egasi): []",
		`updated by 998902222222 (Xurshid Xodim): [{"new": "6 000 so'm", "old": "5 000 so'm", "label": "Narx"}, {"new": "Nok × 1 dona", "old": "Olma × 2 kg", "label": "Mahsulotlar"}]`,
	}, storedHistory(t, pool, order.ID), "the price and the lines, after the order's own fields")

	again, err := s.Update(ctx, sh.scope(), order.ID, staff, edited)
	require.NoError(t, err)
	assert.Equal(t, got, again, "the same money changes nothing")
	assert.Len(t, storedHistory(t, pool, order.ID), 2, "and writes nothing")

	bare, err := s.Update(ctx, sh.scope(), order.ID, staff, same)
	require.NoError(t, err)
	assert.Equal(t, "0.00", bare.Amount, "the price taken away")
	assert.Equal(t, "5.000", stockOf(t, pool, sh.asosiy, sh.nok), "the line taken away")
	assert.Equal(t, `updated by 998902222222 (Xurshid Xodim): [{"new": "", "old": "6 000 so'm", "label": "Narx"}, {"new": "", "old": "Nok × 1 dona", "label": "Mahsulotlar"}]`, storedHistory(t, pool, order.ID)[2])
	assert.Equal(t, []string{"order:0.00", "customer_payment:400.00"}, documentsOf(t, pool, order.ID), "the document stays, with its advance")

	refusedEdit := same
	refusedEdit.Money = moneyOf("", []warehouse.ItemInput{take(sh.olma, "11")})
	_, err = s.Update(ctx, sh.scope(), order.ID, staff, refusedEdit)
	refused(t, err, apperr.Conflict, "stock_insufficient", "«Olma» uchun omborda yetarli qoldiq yo'q")
	assert.Len(t, storedHistory(t, pool, order.ID), 3, "a refusal writes nothing")
}

// Deleting the order hides its document: the products come back, the
// payments go.
func TestDeleteHidesTheDocument(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := stock(t, pool, newShop(t, s, pool, "Olma"))
	in := sh.input(t, "Montaj", "2026-10-10", map[int64]any{sh.izoh.ID: "Ertalab"})
	in.Money = moneyOf("5000", []warehouse.ItemInput{take(sh.olma, "2")}, ledger.PaymentLine{BankAccountID: sh.cash, Amount: ptr("400")})
	order, err := s.Create(ctx, sh.scope(), owner, sh.buyurtma.ID, sh.asosiy, in, sh.existing())
	require.NoError(t, err)

	require.NoError(t, s.Delete(ctx, sh.scope(), order.ID, staff))

	assert.Equal(t, "10.000", stockOf(t, pool, sh.asosiy, sh.olma))
	assert.Empty(t, documentsOf(t, pool, order.ID), "the document and its payment are hidden")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM transactions WHERE deleted_at IS NOT NULL"), "not removed")
}
