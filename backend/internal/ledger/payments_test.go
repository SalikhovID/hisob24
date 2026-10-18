package ledger

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// linkedOf reads the live payments entered with the document: number,
// account, amount, currency and rate.
func linkedOf(t *testing.T, pool *pgxpool.Pool, id int64) []string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT t.number, t.bank_account_id, t.total::text, t.currency_id, r.usd::text, t.supplier_id, t.created_by
		FROM transactions t JOIN currency_rates r ON r.id = t.currency_rate_id WHERE t.linked_id = $1 AND t.kind = 'supplier_payment' AND t.deleted_at IS NULL ORDER BY t.id`, id)
	require.NoError(t, err)
	defer rows.Close()
	var out []string
	for rows.Next() {
		var number int32
		var account, currencyID, supplier int64
		var total, usd, by string
		require.NoError(t, rows.Scan(&number, &account, &total, &currencyID, &usd, &supplier, &by))
		out = append(out, join(number, account, total, currencyID, usd, supplier, by))
	}
	return out
}

func TestWriteLinkedPayments(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	turnOn(t, pool, s.company, 2)
	standardRate(t, pool, s.company, "12800", "0", "2026-10-01 00:00+05")
	card := addAccount(t, pool, s.company, "Karta", 2, true)
	purchase := addDocument(t, q, pool, s, Purchase, 1)
	head := Head{ID: purchase.ID, Kind: Purchase, CompanyID: s.company, SupplierID: &s.bozor, At: purchase.DocAt}

	require.NoError(t, WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: s.cash, Amount: ptr("5000")}, {BankAccountID: card, Amount: ptr("10.5")}}, ali, ptr("Ali aka")))
	assert.Equal(t, []string{
		join(1, s.cash, "5000.00", 1, "12800.0000", s.bozor, ali),
		join(2, card, "10.50", 2, "12800.0000", s.bozor, ali),
	}, linkedOf(t, pool, purchase.ID), "one payment per line, numbered on, in the account's currency, by the rate row in force (the so'm refers to it too)")
	var at string
	require.NoError(t, pool.QueryRow(ctx, "SELECT doc_at::text FROM transactions WHERE linked_id = $1 LIMIT 1", purchase.ID).Scan(&at))
	assert.Equal(t, purchase.DocAt.Format("2006-01-02 15:04:05-07"), at, "at the document's moment")

	require.NoError(t, WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: s.cash, Amount: ptr("7000")}}, vali, nil), "saved again: the old payments go, new ones come")
	assert.Equal(t, []string{join(3, s.cash, "7000.00", 1, "12800.0000", s.bozor, vali)}, linkedOf(t, pool, purchase.ID))
	var hidden int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM transactions WHERE linked_id = $1 AND deleted_at IS NOT NULL", purchase.ID).Scan(&hidden))
	assert.Equal(t, 2, hidden, "hidden, not removed")
	require.NoError(t, WriteLinkedPayments(ctx, q, head, nil, ali, nil), "nothing paid now")
	assert.Empty(t, linkedOf(t, pool, purchase.ID))

	// An account turned off stays in a purchase that already pays from it;
	// a new line may not name it.
	off := addAccount(t, pool, s.company, "Eski", 1, true)
	require.NoError(t, WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: off, Amount: ptr("1")}}, ali, nil))
	_, err := pool.Exec(ctx, "UPDATE bank_accounts SET is_active = false WHERE id = $1", off)
	require.NoError(t, err)
	require.NoError(t, WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: off, Amount: ptr("2")}}, ali, nil), "held already")
	require.NoError(t, WriteLinkedPayments(ctx, q, head, nil, ali, nil))
	err = WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: off, Amount: ptr("2")}}, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Akkaunt nofaol", "new to the purchase")

	nok := newShop(t, pool, "Nok")
	for name, tc := range map[string]struct {
		lines   []PaymentLine
		message string
	}{
		"no account":        {[]PaymentLine{{Amount: ptr("1")}}, "Akkauntni tanlang"},
		"another's account": {[]PaymentLine{{BankAccountID: nok.cash, Amount: ptr("1")}}, "Akkauntni tanlang"},
		"no amount":         {[]PaymentLine{{BankAccountID: s.cash}}, "To'lov summasi noto'g'ri"},
		"a zero amount":     {[]PaymentLine{{BankAccountID: s.cash, Amount: ptr("0")}}, "To'lov summasi noto'g'ri"},
		"a bad amount":      {[]PaymentLine{{BankAccountID: s.cash, Amount: ptr("1,5")}}, "To'lov summasi noto'g'ri"},
		"the second line":   {[]PaymentLine{{BankAccountID: s.cash, Amount: ptr("1")}, {BankAccountID: s.cash, Amount: ptr("-1")}}, "To'lov summasi noto'g'ri"},
	} {
		err := WriteLinkedPayments(ctx, q, head, tc.lines, ali, nil)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	euro := addAccount(t, pool, s.company, "Yevro", 3, true)
	turnOn(t, pool, s.company, 3)
	err = WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: euro, Amount: ptr("1")}}, ali, nil)
	refused(t, err, apperr.Invalid, "validation_error", "Kursni kiriting", "an account in a currency without a rate")
	_ = gen.Transaction{}
}

// The payments entered with an order (its advance) are the customer's,
// linked to the order's document (logic/orders.md, 4.3).
func TestWriteLinkedPaymentsOfAnOrderAreTheCustomers(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	var typ, customer int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO customer_types (company_id, name, position) VALUES ($1, 'Jismoniy', 1) RETURNING id", s.company).Scan(&typ))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO customers (company_id, type_id, phone, created_by) VALUES ($1, $2, '998901234567', $3) RETURNING id", s.company, typ, ali).Scan(&customer))
	// The head is any document of the journal: the kind the head names
	// decides what the payments are.
	document := addDocument(t, q, pool, s, Sale, 1)
	head := Head{ID: document.ID, Kind: Order, CompanyID: s.company, CustomerID: &customer, At: document.DocAt}

	require.NoError(t, WriteLinkedPayments(ctx, q, head, []PaymentLine{{BankAccountID: s.cash, Amount: ptr("400")}}, ali, ptr("Ali aka")))

	var kind string
	var paidBy, linked int64
	require.NoError(t, pool.QueryRow(ctx, "SELECT kind, customer_id, linked_id FROM transactions WHERE linked_id = $1 AND deleted_at IS NULL", document.ID).Scan(&kind, &paidBy, &linked))
	assert.Equal(t, "customer_payment", kind, "the customer pays")
	assert.Equal(t, customer, paidBy)
	assert.Equal(t, document.ID, linked)
}
