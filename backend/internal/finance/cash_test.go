package finance

import (
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// cashOf is the cash account the company started with.
func cashOf(t *testing.T, pool *pgxpool.Pool, companyID int64) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT id FROM bank_accounts WHERE company_id = $1 AND name = 'Naqd'", companyID).Scan(&id))
	return id
}

// stored is a document's row as the journal keeps it.
type stored struct {
	kind, total, currency, createdBy string
	number                           int32
	account, category                int64
	deleted                          bool
}

func storedOf(t *testing.T, pool *pgxpool.Pool, id int64) stored {
	t.Helper()
	var r stored
	var category *int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT kind, number, bank_account_id, category_id, total::text, currency_id::text, created_by, deleted_at IS NOT NULL FROM transactions WHERE id = $1", id).
		Scan(&r.kind, &r.number, &r.account, &category, &r.total, &r.currency, &r.createdBy, &r.deleted))
	if category != nil {
		r.category = *category
	}
	return r
}

func idsOfDocuments(items []Document) []int64 {
	ids := make([]int64, 0, len(items))
	for _, d := range items {
		ids = append(ids, d.ID)
	}
	return ids
}

func TestCashOpenings(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	cash := cashOf(t, pool, olma)
	turnOn(t, pool, olma, 2)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)

	d, err := s.AddCashOpening(ctx, olma, ali, CashOpeningInput{BankAccountID: cash, Amount: ptr("1000000"), At: "2026-10-01T10:00:00+05:00", Note: ptr(" Boshlanish ")})
	require.NoError(t, err)
	assert.Positive(t, d.ID)
	assert.Equal(t, ledger.CashOpening, d.Kind)
	assert.EqualValues(t, 1, d.Number)
	assert.Equal(t, cash, d.BankAccountID)
	assert.Equal(t, "Naqd", d.AccountName)
	assert.EqualValues(t, 1, d.CurrencyID, "the account's currency")
	assert.Equal(t, "1000000.00", d.Amount)
	assert.Equal(t, "2026-10-01T05:00:00Z", d.At.UTC().Format(time.RFC3339))
	assert.Equal(t, ptr("Boshlanish"), d.Note, "trimmed")
	assert.Equal(t, ptr("Ali aka"), d.CreatedByName)
	assert.Nil(t, d.ToAccountName)
	assert.Nil(t, d.CategoryName)
	assert.Nil(t, d.Rate)
	assert.Equal(t, stored{kind: "cash_opening", number: 1, account: cash, total: "1000000.00", currency: "1", createdBy: ali}, storedOf(t, pool, d.ID))

	// The dollar has no rate yet: a cash document needs none.
	usd, err := s.AddCashOpening(ctx, olma, ali, CashOpeningInput{BankAccountID: card.ID, Amount: ptr("250.5"), At: "2026-10-01T11:00:00+05:00"})
	require.NoError(t, err)
	assert.EqualValues(t, 2, usd.Number, "numbered on, within the kind")
	assert.EqualValues(t, 2, usd.CurrencyID)
	assert.Equal(t, "250.50", usd.Amount)
	assert.Nil(t, usd.Note)

	old, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Eski", CurrencyID: 1})
	require.NoError(t, err)
	_, err = s.UpdateAccount(ctx, olma, old.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)
	for name, tc := range map[string]struct {
		in      CashOpeningInput
		message string
	}{
		"no account":                 {CashOpeningInput{Amount: ptr("5"), At: "2026-10-01T10:00:00+05:00"}, "Akkauntni tanlang"},
		"an unknown account":         {CashOpeningInput{BankAccountID: 999_999, Amount: ptr("5"), At: "2026-10-01T10:00:00+05:00"}, "Akkauntni tanlang"},
		"another company's account":  {CashOpeningInput{BankAccountID: cashOf(t, pool, nok), Amount: ptr("5"), At: "2026-10-01T10:00:00+05:00"}, "Akkauntni tanlang"},
		"an account turned off":      {CashOpeningInput{BankAccountID: old.ID, Amount: ptr("5"), At: "2026-10-01T10:00:00+05:00"}, "Akkaunt nofaol"},
		"the account before the sum": {CashOpeningInput{BankAccountID: old.ID, Amount: ptr("x"), At: "2026-10-01T10:00:00+05:00"}, "Akkaunt nofaol"},
		"no moment":                  {CashOpeningInput{BankAccountID: cash, Amount: ptr("5")}, "Vaqtni kiriting"},
		"not a moment":               {CashOpeningInput{BankAccountID: cash, Amount: ptr("5"), At: "yesterday"}, "Vaqt noto'g'ri"},
		"the moment before the sum":  {CashOpeningInput{BankAccountID: cash, Amount: ptr("x"), At: "yesterday"}, "Vaqt noto'g'ri"},
		"no amount":                  {CashOpeningInput{BankAccountID: cash, At: "2026-10-01T10:00:00+05:00"}, "Summani kiriting"},
		"a zero amount":              {CashOpeningInput{BankAccountID: cash, Amount: ptr("0"), At: "2026-10-01T10:00:00+05:00"}, "Summa noto'g'ri"},
		"a long note":                {CashOpeningInput{BankAccountID: cash, Amount: ptr("5"), At: "2026-10-01T10:00:00+05:00", Note: ptr(strings.Repeat("a", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddCashOpening(ctx, olma, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}

	// An edit: another account and amount; the number stays, the currency
	// follows the account.
	saved, err := s.UpdateCashOpening(ctx, olma, ali, d.ID, CashOpeningInput{BankAccountID: card.ID, Amount: ptr("80"), At: "2026-10-02T10:00:00+05:00"})
	require.NoError(t, err)
	assert.Equal(t, d.ID, saved.ID)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, card.ID, saved.BankAccountID)
	assert.EqualValues(t, 2, saved.CurrencyID)
	assert.Equal(t, "80.00", saved.Amount)
	assert.Equal(t, "2026-10-02T05:00:00Z", saved.At.UTC().Format(time.RFC3339))
	assert.Nil(t, saved.Note, "a note left out is cleared")
	assert.True(t, saved.UpdatedAt.After(saved.CreatedAt))
	// The account a document already names stays, turned off or not;
	// another one turned off does not do.
	_, err = s.UpdateAccount(ctx, olma, card.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)
	saved, err = s.UpdateCashOpening(ctx, olma, ali, d.ID, CashOpeningInput{BankAccountID: card.ID, Amount: ptr("90"), At: "2026-10-02T10:00:00+05:00"})
	require.NoError(t, err, "kept")
	assert.Equal(t, "90.00", saved.Amount)
	_, err = s.UpdateCashOpening(ctx, olma, ali, d.ID, CashOpeningInput{BankAccountID: old.ID, Amount: ptr("90"), At: "2026-10-02T10:00:00+05:00"})
	refused(t, err, apperr.Invalid, "validation_error", "Akkaunt nofaol", "another account turned off")
	_, err = s.UpdateCashOpening(ctx, olma, ali, 999_999, CashOpeningInput{BankAccountID: cash, Amount: ptr("5"), At: "2026-10-02T10:00:00+05:00"})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "unknown")
	_, err = s.UpdateCashOpening(ctx, nok, ali, d.ID, CashOpeningInput{BankAccountID: cash, Amount: ptr("5"), At: "2026-10-02T10:00:00+05:00"})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "another company's")

	// Reading and listing: the newest first; narrowed to an account.
	got, err := s.GetDocument(ctx, olma, d.ID, ledger.CashOpening)
	require.NoError(t, err)
	assert.Equal(t, saved, got)
	_, err = s.GetDocument(ctx, olma, d.ID, ledger.Expense, ledger.Income)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "of another kind")
	_, err = s.GetDocument(ctx, nok, d.ID, ledger.CashOpening)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "another company's")
	page, err := s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.CashOpening}, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{d.ID, usd.ID}, idsOfDocuments(page.Items), "the newest first: the edited one is on the 2nd now")
	assert.EqualValues(t, 2, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, ledger.PageSize, page.PageSize)
	page, err = s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.CashOpening}, AccountID: &cash, Page: 1})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "the cash holds no opening now")
	assert.EqualValues(t, 0, page.Total)
	_, err = s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.CashOpening}, Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri", "page 0")

	// A deletion hides the document; its number is never given again.
	require.NoError(t, s.DeleteDocument(ctx, olma, d.ID, ledger.CashOpening))
	assert.True(t, storedOf(t, pool, d.ID).deleted)
	_, err = s.GetDocument(ctx, olma, d.ID, ledger.CashOpening)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted")
	err = s.DeleteDocument(ctx, olma, d.ID, ledger.CashOpening)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted twice")
	err = s.DeleteDocument(ctx, olma, usd.ID, ledger.Expense)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "of another kind")
	third, err := s.AddCashOpening(ctx, olma, ali, CashOpeningInput{BankAccountID: cash, Amount: ptr("1"), At: "2026-10-03T10:00:00+05:00"})
	require.NoError(t, err)
	assert.EqualValues(t, 3, third.Number)
}

func TestExpenses(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	cash := cashOf(t, pool, olma)
	ijara, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Ijara", Kind: KindExpense})
	require.NoError(t, err)
	kommunal, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Kommunal", Kind: KindExpense})
	require.NoError(t, err)
	boshqa, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Boshqa kirim", Kind: KindIncome})
	require.NoError(t, err)
	eski, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Eski", Kind: KindExpense})
	require.NoError(t, err)
	_, err = s.UpdateCategory(ctx, olma, eski.ID, CategoryPatch{Active: ptr(false)})
	require.NoError(t, err)
	foreign, err := s.CreateCategory(ctx, nok, CategoryInput{Name: "Ijara", Kind: KindExpense})
	require.NoError(t, err)
	old, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Eski", CurrencyID: 1})
	require.NoError(t, err)
	_, err = s.UpdateAccount(ctx, olma, old.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)

	rent, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("150000"), At: "2026-10-03T10:00:00+05:00", Note: ptr("Oktabr")})
	require.NoError(t, err)
	assert.Equal(t, ledger.Expense, rent.Kind)
	assert.EqualValues(t, 1, rent.Number)
	assert.Equal(t, "Naqd", rent.AccountName)
	assert.Equal(t, &ijara.ID, rent.CategoryID)
	assert.Equal(t, ptr("Ijara"), rent.CategoryName)
	assert.Equal(t, "150000.00", rent.Amount)
	assert.Equal(t, ptr("Oktabr"), rent.Note)
	assert.Equal(t, stored{kind: "expense", number: 1, account: cash, category: ijara.ID, total: "150000.00", currency: "1", createdBy: ali}, storedOf(t, pool, rent.ID))
	income, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindIncome, BankAccountID: cash, CategoryID: boshqa.ID, Amount: ptr("200000"), At: "2026-10-02T10:00:00+05:00"})
	require.NoError(t, err)
	assert.Equal(t, ledger.Income, income.Kind)
	assert.EqualValues(t, 1, income.Number, "an income is numbered apart from the expenses")
	assert.Equal(t, ptr("Boshqa kirim"), income.CategoryName)

	at := "2026-10-03T10:00:00+05:00"
	for name, tc := range map[string]struct {
		in      ExpenseInput
		message string
	}{
		"no kind":                         {ExpenseInput{BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at}, "Turni tanlang"},
		"not a kind":                      {ExpenseInput{Kind: "gift", BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at}, "Tur noto'g'ri"},
		"no account":                      {ExpenseInput{Kind: KindExpense, CategoryID: ijara.ID, Amount: ptr("5"), At: at}, "Akkauntni tanlang"},
		"an account turned off":           {ExpenseInput{Kind: KindExpense, BankAccountID: old.ID, CategoryID: ijara.ID, Amount: ptr("5"), At: at}, "Akkaunt nofaol"},
		"the account before the category": {ExpenseInput{Kind: KindExpense, BankAccountID: old.ID, Amount: ptr("5"), At: at}, "Akkaunt nofaol"},
		"no category":                     {ExpenseInput{Kind: KindExpense, BankAccountID: cash, Amount: ptr("5"), At: at}, "Kategoriyani tanlang"},
		"an unknown category":             {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: 999_999, Amount: ptr("5"), At: at}, "Kategoriyani tanlang"},
		"another company's category":      {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: foreign.ID, Amount: ptr("5"), At: at}, "Kategoriyani tanlang"},
		"a category of the other kind":    {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: boshqa.ID, Amount: ptr("5"), At: at}, "Kategoriya turi mos emas"},
		"an income under an expense's":    {ExpenseInput{Kind: KindIncome, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at}, "Kategoriya turi mos emas"},
		"a category turned off":           {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: eski.ID, Amount: ptr("5"), At: at}, "Kategoriya nofaol"},
		"the category before the moment":  {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: eski.ID, Amount: ptr("5")}, "Kategoriya nofaol"},
		"no moment":                       {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5")}, "Vaqtni kiriting"},
		"no amount":                       {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, At: at}, "Summani kiriting"},
		"a negative amount":               {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("-5"), At: at}, "Summa noto'g'ri"},
		"a long note":                     {ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at, Note: ptr(strings.Repeat("a", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddExpense(ctx, olma, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}

	// An edit keeps the kind and the number; the category and the amount
	// change. A category turned off since stays when sent back; another
	// one turned off does not do.
	_, err = s.UpdateExpense(ctx, olma, ali, rent.ID, ExpenseInput{Kind: KindIncome, BankAccountID: cash, CategoryID: boshqa.ID, Amount: ptr("5"), At: at})
	refused(t, err, apperr.Invalid, "validation_error", "Tur o'zgartirilmaydi", "an expense made an income")
	saved, err := s.UpdateExpense(ctx, olma, ali, rent.ID, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: kommunal.ID, Amount: ptr("160000"), At: "2026-10-04T10:00:00+05:00"})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, ptr("Kommunal"), saved.CategoryName)
	assert.Equal(t, "160000.00", saved.Amount)
	assert.Nil(t, saved.Note)
	_, err = s.UpdateCategory(ctx, olma, kommunal.ID, CategoryPatch{Active: ptr(false)})
	require.NoError(t, err)
	saved, err = s.UpdateExpense(ctx, olma, ali, rent.ID, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: kommunal.ID, Amount: ptr("170000"), At: "2026-10-04T10:00:00+05:00"})
	require.NoError(t, err, "the category it already has stays")
	assert.Equal(t, "170000.00", saved.Amount)
	_, err = s.UpdateExpense(ctx, olma, ali, rent.ID, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: eski.ID, Amount: ptr("170000"), At: "2026-10-04T10:00:00+05:00"})
	refused(t, err, apperr.Invalid, "validation_error", "Kategoriya nofaol", "another category turned off")
	_, err = s.UpdateExpense(ctx, olma, ali, income.ID, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at})
	refused(t, err, apperr.Invalid, "validation_error", "Tur o'zgartirilmaydi", "an income made an expense")
	_, err = s.UpdateExpense(ctx, olma, ali, 999_999, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: at})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "unknown")

	// The lists: by kind, by category, by a span of moments.
	page, err := s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.Expense}, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{rent.ID}, idsOfDocuments(page.Items))
	page, err = s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.Expense, ledger.Income}, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{rent.ID, income.ID}, idsOfDocuments(page.Items), "the newest first")
	page, err = s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.Expense, ledger.Income}, CategoryID: &boshqa.ID, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{income.ID}, idsOfDocuments(page.Items))
	from, to := time.Date(2026, 10, 1, 19, 0, 0, 0, time.UTC), time.Date(2026, 10, 2, 19, 0, 0, 0, time.UTC)
	page, err = s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.Expense, ledger.Income}, From: &from, To: &to, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{income.ID}, idsOfDocuments(page.Items), "the 2nd of October in Tashkent")
	assert.EqualValues(t, 1, page.Total)

	require.NoError(t, s.DeleteDocument(ctx, olma, rent.ID, ledger.Expense, ledger.Income))
	_, err = s.GetDocument(ctx, olma, rent.ID, ledger.Expense, ledger.Income)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted")
	next, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("1"), At: at})
	require.NoError(t, err)
	assert.EqualValues(t, 2, next.Number, "the number of the deleted one is never given again")
}
