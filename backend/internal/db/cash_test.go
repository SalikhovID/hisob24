package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// cashKinds are the five cash documents.
var cashKinds = []string{"cash_opening", "expense", "income", "money_transfer", "conversion"}

// addAccountRow adds an account of the company straight into the table.
func addAccountRow(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, currencyID int64, active bool) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO bank_accounts (company_id, name, currency_id, is_active) VALUES ($1, $2, $3, $4) RETURNING id", companyID, name, currencyID, active).Scan(&id))
	return id
}

// books is Olma's cash in October: the cash opened with 1 000 000 on the
// 1st (the old account with 7 000 the same morning), 200 000 other income
// on the 2nd, 150 000 rent on the 3rd, 50 000 paid to Bozor with a
// purchase and 30 000 received from a customer on the 4th, 100 000 moved
// to the second cash on the 5th, 128 000 turned into 10 dollars on the
// card on the 6th; a deleted expense and another company's opening beside.
type books struct {
	w                                                            warehouse
	cash, card, kassa2, eski, ijara, boshqa                      int64
	opening, old, income, rent, paid, received, moved, converted int64
	gone, purchase                                               int64
	customerPhone                                                string
}

func newBooks(t *testing.T, q *gen.Queries, pool *pgxpool.Pool) books {
	t.Helper()
	ctx := t.Context()
	b := books{w: newWarehouse(t, q, pool)}
	standardRate(t, pool, b.w.company, "12800", "2026-10-01 00:00+05")
	b.cash = cashOf(t, pool, b.w.company)
	b.card = addAccountRow(t, pool, b.w.company, "Karta", 2, true)
	b.kassa2 = addAccountRow(t, pool, b.w.company, "Kassa 2", 1, true)
	b.eski = addAccountRow(t, pool, b.w.company, "Eski", 1, false)
	ijara, err := q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: b.w.company, Name: "Ijara", Kind: "expense"})
	require.NoError(t, err)
	boshqa, err := q.CreateFinanceCategory(ctx, gen.CreateFinanceCategoryParams{CompanyID: b.w.company, Name: "Boshqa kirim", Kind: "income"})
	require.NoError(t, err)
	b.ijara, b.boshqa = ijara.ID, boshqa.ID
	jismoniy := createType(t, q, b.w.company, "Jismoniy")
	b.customerPhone = "998911112233"
	dilshod := createCustomer(t, q, b.w.company, jismoniy.ID, b.customerPhone)
	b.purchase = addPurchase(t, pool, b.w.company, b.w.asosiy, b.w.bozor, b.w.olma, 1, "1", "50000", false)

	b.opening = addDocument(t, pool, b.w.company, doc{kind: "cash_opening", number: 1, at: "2026-10-01 10:00+05", account: &b.cash, total: "1000000"})
	b.old = addDocument(t, pool, b.w.company, doc{kind: "cash_opening", number: 2, at: "2026-10-01 09:00+05", account: &b.eski, total: "7000"})
	b.income = addDocument(t, pool, b.w.company, doc{kind: "income", number: 1, at: "2026-10-02 10:00+05", account: &b.cash, category: &b.boshqa, total: "200000"})
	b.rent = addDocument(t, pool, b.w.company, doc{kind: "expense", number: 1, at: "2026-10-03 10:00+05", account: &b.cash, category: &b.ijara, total: "150000"})
	b.paid = addDocument(t, pool, b.w.company, doc{kind: "supplier_payment", number: 1, at: "2026-10-04 10:00+05", supplier: &b.w.bozor, account: &b.cash, linked: &b.purchase, total: "50000"})
	b.received = addDocument(t, pool, b.w.company, doc{kind: "customer_payment", number: 1, at: "2026-10-04 11:00+05", customer: &dilshod.ID, account: &b.cash, total: "30000"})
	b.moved = addDocument(t, pool, b.w.company, doc{kind: "money_transfer", number: 1, at: "2026-10-05 10:00+05", account: &b.cash, toAccount: &b.kassa2, total: "100000"})
	b.converted = addDocument(t, pool, b.w.company, doc{kind: "conversion", number: 1, at: "2026-10-06 10:00+05", account: &b.cash, toAccount: &b.card, total: "128000", toTotal: "10"})
	b.gone = addDocument(t, pool, b.w.company, doc{kind: "expense", number: 2, at: "2026-10-06 12:00+05", account: &b.cash, category: &b.ijara, total: "999", deleted: true})
	anor := createCompany(t, q, "Anor", today(t, pool)).ID
	anorCash := cashOf(t, pool, anor)
	addDocument(t, pool, anor, doc{kind: "cash_opening", number: 1, account: &anorCash, total: "5"})
	return b
}

func idsOf[T any](rows []T, id func(T) int64) []int64 {
	out := make([]int64, 0, len(rows))
	for _, r := range rows {
		out = append(out, id(r))
	}
	return out
}

// What an account holds is the sum of its live documents, in its own
// currency: a transfer leaves one account and arrives in another, a
// conversion leaves in one currency and arrives in another.
func TestAccountBalances(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newBooks(t, q, pool)

	rows, err := q.ListAccountBalances(ctx, b.w.company)
	require.NoError(t, err)
	require.Len(t, rows, 4, "the company's live accounts")
	assert.Equal(t, []int64{b.cash, b.card, b.kassa2, b.eski}, idsOf(rows, func(r gen.ListAccountBalancesRow) int64 { return r.ID }), "the active first, in the order added; the one turned off last")
	assert.Equal(t, "802000.00", numericText(t, rows[0].Balance), "1 000 000 + 200 000 − 150 000 − 50 000 + 30 000 − 100 000 − 128 000")
	assert.Equal(t, "10.00", numericText(t, rows[1].Balance), "the dollars that arrived")
	assert.EqualValues(t, 2, rows[1].CurrencyID)
	assert.Equal(t, "100000.00", numericText(t, rows[2].Balance), "what was moved in")
	assert.Equal(t, "7000.00", numericText(t, rows[3].Balance), "an account turned off still holds its money")
	assert.False(t, rows[3].IsActive)

	one, err := q.GetAccountBalance(ctx, gen.GetAccountBalanceParams{ID: b.cash, CompanyID: b.w.company})
	require.NoError(t, err)
	assert.Equal(t, "802000.00", numericText(t, one.Balance))
	assert.Equal(t, "Naqd", one.Name)
	nok := createCompany(t, q, "Nok", today(t, pool)).ID
	_, err = q.GetAccountBalance(ctx, gen.GetAccountBalanceParams{ID: b.cash, CompanyID: nok})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's account is not found")
}

// The statement walks the account's documents in time with what it held
// after each; each row names the other side: the supplier or the customer,
// the category, the other account.
func TestAccountStatement(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newBooks(t, q, pool)

	rows, err := q.ListAccountStatement(ctx, gen.ListAccountStatementParams{CompanyID: b.w.company, AccountID: b.cash, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 7, "every live document that names the cash, as the source or the target")
	assert.Equal(t, []int64{b.converted, b.moved, b.received, b.paid, b.rent, b.income, b.opening}, idsOf(rows, func(r gen.ListAccountStatementRow) int64 { return r.ID }), "the newest first")
	assert.Equal(t, "conversion", rows[0].Kind)
	assert.Equal(t, "-128000.00", numericText(t, rows[0].Delta), "a conversion leaves with its amount")
	assert.Equal(t, "802000.00", numericText(t, rows[0].Balance))
	assert.Equal(t, ptr("Karta"), rows[0].OtherAccountName, "the account it went to")
	assert.Equal(t, "-100000.00", numericText(t, rows[1].Delta))
	assert.Equal(t, "930000.00", numericText(t, rows[1].Balance))
	assert.Equal(t, ptr("Kassa 2"), rows[1].OtherAccountName)
	assert.Equal(t, "30000.00", numericText(t, rows[2].Delta), "a customer's payment arrives")
	assert.Equal(t, "1030000.00", numericText(t, rows[2].Balance))
	assert.Equal(t, ptr(b.customerPhone), rows[2].CustomerPhone, "the customer's phone; no name answered")
	assert.Nil(t, rows[2].CustomerName)
	assert.Nil(t, rows[2].SupplierName)
	assert.Equal(t, "-50000.00", numericText(t, rows[3].Delta), "a supplier's payment leaves")
	assert.Equal(t, "1000000.00", numericText(t, rows[3].Balance))
	assert.Equal(t, ptr("Bozor"), rows[3].SupplierName)
	assert.Nil(t, rows[3].CustomerPhone)
	assert.Equal(t, &b.purchase, rows[3].LinkedID)
	assert.Equal(t, ptr(int32(1)), rows[3].LinkedNumber, "the purchase it was entered with")
	assert.Equal(t, "-150000.00", numericText(t, rows[4].Delta))
	assert.Equal(t, ptr("Ijara"), rows[4].CategoryName, "the category")
	assert.Equal(t, "200000.00", numericText(t, rows[5].Delta))
	assert.Equal(t, ptr("Boshqa kirim"), rows[5].CategoryName)
	assert.Equal(t, "1000000.00", numericText(t, rows[6].Delta))
	assert.Equal(t, "1000000.00", numericText(t, rows[6].Balance), "what it held after the first document")
	assert.Nil(t, rows[6].OtherAccountName, "an opening balance has no other side")
	assert.Nil(t, rows[6].CategoryName)
	assert.Nil(t, rows[6].LinkedID)
	assert.Equal(t, ptr("Ali aka"), rows[6].CreatedByName)

	count, err := q.CountAccountStatement(ctx, gen.CountAccountStatementParams{CompanyID: b.w.company, AccountID: b.cash})
	require.NoError(t, err)
	assert.EqualValues(t, 7, count)
	rows, err = q.ListAccountStatement(ctx, gen.ListAccountStatementParams{CompanyID: b.w.company, AccountID: b.cash, Limit: 2, Offset: 2})
	require.NoError(t, err)
	require.Len(t, rows, 2, "paged")
	assert.Equal(t, b.received, rows[0].ID)
	assert.Equal(t, "1030000.00", numericText(t, rows[0].Balance), "the balance is of the whole, not the page")

	rows, err = q.ListAccountStatement(ctx, gen.ListAccountStatementParams{CompanyID: b.w.company, AccountID: b.card, Limit: 20})
	require.NoError(t, err)
	require.Len(t, rows, 1, "the card: the conversion alone, as its target")
	assert.Equal(t, "10.00", numericText(t, rows[0].Delta), "a conversion arrives with the amount that arrives")
	assert.Equal(t, "10.00", numericText(t, rows[0].Balance))
	assert.Equal(t, ptr("Naqd"), rows[0].OtherAccountName, "the account it came from")
}

// The cash documents are read as one shape and listed by kind, narrowed to
// an account (as the source or the target), a category and a span of
// moments; the deleted ones and other companies' are not there.
func TestCashDocuments(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	b := newBooks(t, q, pool)
	ids := func(rows []gen.ListCashDocumentsRow) []int64 {
		return idsOf(rows, func(r gen.ListCashDocumentsRow) int64 { return r.ID })
	}

	one, err := q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: b.converted, CompanyID: b.w.company, Kinds: []string{"conversion"}})
	require.NoError(t, err)
	assert.Equal(t, "conversion", one.Kind)
	assert.EqualValues(t, 1, one.Number)
	assert.Equal(t, "Naqd", one.AccountName)
	assert.EqualValues(t, 1, one.CurrencyID)
	assert.Equal(t, ptr("Karta"), one.ToAccountName)
	assert.Equal(t, ptr(int64(2)), one.ToCurrencyID)
	assert.Equal(t, "128000.00", numericText(t, one.Total))
	assert.Equal(t, "10.00", numericText(t, one.ToTotal))
	assert.Nil(t, one.CategoryName)
	assert.Equal(t, ptr("Ali aka"), one.CreatedByName)
	rent, err := q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: b.rent, CompanyID: b.w.company, Kinds: []string{"expense", "income"}})
	require.NoError(t, err)
	assert.Equal(t, ptr("Ijara"), rent.CategoryName)
	assert.Nil(t, rent.ToAccountName)
	assert.False(t, rent.ToTotal.Valid, "no amount arrives")
	_, err = q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: b.converted, CompanyID: b.w.company, Kinds: []string{"money_transfer"}})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a conversion is no transfer")
	_, err = q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: b.gone, CompanyID: b.w.company, Kinds: cashKinds})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted")
	_, err = q.GetCashDocument(ctx, gen.GetCashDocumentParams{ID: b.paid, CompanyID: b.w.company, Kinds: cashKinds})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a supplier's payment is no cash document")

	rows, err := q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.converted, b.moved, b.rent, b.income, b.opening, b.old}, ids(rows), "every live cash document, the newest first")
	count, err := q.CountCashDocuments(ctx, gen.CountCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds})
	require.NoError(t, err)
	assert.EqualValues(t, 6, count)
	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, Limit: 2, Offset: 2})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.rent, b.income}, ids(rows), "paged")

	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: []string{"expense"}, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.rent}, ids(rows), "one kind; the deleted one is not there")
	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: []string{"money_transfer", "conversion"}, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.converted, b.moved}, ids(rows), "the transfers and the conversions in one list")

	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, AccountID: &b.card, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.converted}, ids(rows), "an account as the target counts")
	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, AccountID: &b.kassa2, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.moved}, ids(rows))
	count, err = q.CountCashDocuments(ctx, gen.CountCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, AccountID: &b.cash})
	require.NoError(t, err)
	assert.EqualValues(t, 5, count, "the cash: all but the old account's opening")

	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: []string{"expense", "income"}, CategoryID: &b.ijara, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.rent}, ids(rows), "by category")

	from, to := at(t, "2026-10-02 00:00+05"), at(t, "2026-10-04 00:00+05")
	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, FromAt: &from, ToAt: &to, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.rent, b.income}, ids(rows), "from the 2nd up to, not including, the 4th")
	count, err = q.CountCashDocuments(ctx, gen.CountCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, FromAt: &from, ToAt: &to})
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	rows, err = q.ListCashDocuments(ctx, gen.ListCashDocumentsParams{CompanyID: b.w.company, Kinds: cashKinds, ToAt: &from, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, []int64{b.opening, b.old}, ids(rows), "up to a moment alone")

	n, err := q.CountAccountDocuments(ctx, b.cash)
	require.NoError(t, err)
	assert.EqualValues(t, 7, n, "the live documents that name the cash, as the source or the target")
	n, err = q.CountAccountDocuments(ctx, b.card)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "as a target")
	n, err = q.CountCategoryDocuments(ctx, b.ijara)
	require.NoError(t, err)
	assert.EqualValues(t, 1, n, "the deleted expense is not counted")
}
