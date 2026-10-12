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

// targetOf is the account a document goes to, as the journal keeps it.
func targetOf(t *testing.T, pool *pgxpool.Pool, id int64) (int64, string) {
	t.Helper()
	var target *int64
	var toTotal *string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT to_bank_account_id, to_total::text FROM transactions WHERE id = $1", id).Scan(&target, &toTotal))
	var text string
	if toTotal != nil {
		text = *toTotal
	}
	if target == nil {
		return 0, text
	}
	return *target, text
}

func TestMoneyTransfers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	cash := cashOf(t, pool, olma)
	turnOn(t, pool, olma, 2)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)
	kassa2, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Kassa 2", CurrencyID: 1})
	require.NoError(t, err)
	old, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Eski", CurrencyID: 1})
	require.NoError(t, err)
	_, err = s.UpdateAccount(ctx, olma, old.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)
	at := "2026-10-05T10:00:00+05:00"

	d, err := s.AddMoneyTransfer(ctx, olma, ali, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("100000"), At: at, Note: ptr("Kassaga")})
	require.NoError(t, err)
	assert.Equal(t, ledger.MoneyTransfer, d.Kind)
	assert.EqualValues(t, 1, d.Number)
	assert.Equal(t, cash, d.BankAccountID)
	assert.Equal(t, "Naqd", d.AccountName)
	assert.EqualValues(t, 1, d.CurrencyID)
	assert.Equal(t, "100000.00", d.Amount)
	assert.Equal(t, &kassa2.ID, d.ToBankAccountID)
	assert.Equal(t, ptr("Kassa 2"), d.ToAccountName)
	assert.Equal(t, ptr(int64(1)), d.ToCurrencyID)
	assert.Nil(t, d.ToAmount, "the same amount arrives")
	assert.Nil(t, d.Rate)
	assert.Nil(t, d.CategoryName)
	assert.Equal(t, ptr("Kassaga"), d.Note)
	assert.Equal(t, stored{kind: "money_transfer", number: 1, account: cash, total: "100000.00", currency: "1", createdBy: ali}, storedOf(t, pool, d.ID))
	target, toTotal := targetOf(t, pool, d.ID)
	assert.Equal(t, kassa2.ID, target)
	assert.Empty(t, toTotal)

	for name, tc := range map[string]struct {
		in      MoneyTransferInput
		message string
	}{
		"no account":                    {MoneyTransferInput{ToAccountID: kassa2.ID, Amount: ptr("5"), At: at}, "Akkauntni tanlang"},
		"an account turned off":         {MoneyTransferInput{FromAccountID: old.ID, ToAccountID: kassa2.ID, Amount: ptr("5"), At: at}, "Akkaunt nofaol"},
		"the account before the target": {MoneyTransferInput{FromAccountID: old.ID, Amount: ptr("5"), At: at}, "Akkaunt nofaol"},
		"no target":                     {MoneyTransferInput{FromAccountID: cash, Amount: ptr("5"), At: at}, "Maqsad akkauntni tanlang"},
		"an unknown target":             {MoneyTransferInput{FromAccountID: cash, ToAccountID: 999_999, Amount: ptr("5"), At: at}, "Maqsad akkauntni tanlang"},
		"another company's target":      {MoneyTransferInput{FromAccountID: cash, ToAccountID: cashOf(t, pool, nok), Amount: ptr("5"), At: at}, "Maqsad akkauntni tanlang"},
		"a target turned off":           {MoneyTransferInput{FromAccountID: cash, ToAccountID: old.ID, Amount: ptr("5"), At: at}, "Maqsad akkaunt nofaol"},
		"the same account":              {MoneyTransferInput{FromAccountID: cash, ToAccountID: cash, Amount: ptr("5"), At: at}, "Maqsad akkaunt boshqa bo'lsin"},
		"another currency":              {MoneyTransferInput{FromAccountID: cash, ToAccountID: card.ID, Amount: ptr("5"), At: at}, "Valyutalar farq qilsa konvertatsiya kiriting"},
		"the target before the moment":  {MoneyTransferInput{FromAccountID: cash, ToAccountID: card.ID, Amount: ptr("5")}, "Valyutalar farq qilsa konvertatsiya kiriting"},
		"no moment":                     {MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("5")}, "Vaqtni kiriting"},
		"no amount":                     {MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, At: at}, "Summani kiriting"},
		"a long note":                   {MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("5"), At: at, Note: ptr(strings.Repeat("a", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddMoneyTransfer(ctx, olma, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}

	// An edit turns it around; the number stays. The accounts it already
	// names stay, turned off or not.
	saved, err := s.UpdateMoneyTransfer(ctx, olma, ali, d.ID, MoneyTransferInput{FromAccountID: kassa2.ID, ToAccountID: cash, Amount: ptr("60000"), At: "2026-10-06T10:00:00+05:00"})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, kassa2.ID, saved.BankAccountID)
	assert.Equal(t, &cash, saved.ToBankAccountID)
	assert.Equal(t, "60000.00", saved.Amount)
	assert.Nil(t, saved.Note)
	_, err = s.UpdateAccount(ctx, olma, kassa2.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)
	_, err = s.UpdateMoneyTransfer(ctx, olma, ali, d.ID, MoneyTransferInput{FromAccountID: kassa2.ID, ToAccountID: cash, Amount: ptr("70000"), At: "2026-10-06T10:00:00+05:00"})
	require.NoError(t, err, "the source it already names, turned off since")
	_, err = s.UpdateMoneyTransfer(ctx, olma, ali, d.ID, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("70000"), At: "2026-10-06T10:00:00+05:00"})
	require.NoError(t, err, "the target it already names, turned off since")
	_, err = s.UpdateMoneyTransfer(ctx, olma, ali, d.ID, MoneyTransferInput{FromAccountID: cash, ToAccountID: old.ID, Amount: ptr("70000"), At: "2026-10-06T10:00:00+05:00"})
	refused(t, err, apperr.Invalid, "validation_error", "Maqsad akkaunt nofaol", "another target turned off")
	_, err = s.UpdateMoneyTransfer(ctx, olma, ali, 999_999, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("5"), At: at})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "unknown")

	got, err := s.GetDocument(ctx, olma, d.ID, ledger.MoneyTransfer, ledger.Conversion)
	require.NoError(t, err)
	assert.Equal(t, "70000.00", got.Amount)
	require.NoError(t, s.DeleteDocument(ctx, olma, d.ID, ledger.MoneyTransfer, ledger.Conversion))
	_, err = s.GetDocument(ctx, olma, d.ID, ledger.MoneyTransfer, ledger.Conversion)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted")
	_, err = s.AddMoneyTransfer(ctx, olma, ali, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("1"), At: at})
	refused(t, err, apperr.Invalid, "validation_error", "Maqsad akkaunt nofaol", "a new transfer into the account turned off")
	_, err = s.UpdateAccount(ctx, olma, kassa2.ID, AccountPatch{Active: ptr(true)})
	require.NoError(t, err)
	next, err := s.AddMoneyTransfer(ctx, olma, ali, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("1"), At: at})
	require.NoError(t, err)
	assert.EqualValues(t, 2, next.Number, "the number of the deleted one is never given again")
}

func TestConversions(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	cash := cashOf(t, pool, olma)
	turnOn(t, pool, olma, 2)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)
	kassa2, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Kassa 2", CurrencyID: 1})
	require.NoError(t, err)
	at := "2026-10-06T10:00:00+05:00"

	c, err := s.AddConversion(ctx, olma, ali, ConversionInput{FromAccountID: cash, Amount: ptr("128000"), ToAccountID: card.ID, ToAmount: ptr("10"), At: at, Note: ptr("Dollar oldik")})
	require.NoError(t, err)
	assert.Equal(t, ledger.Conversion, c.Kind)
	assert.EqualValues(t, 1, c.Number)
	assert.Equal(t, cash, c.BankAccountID)
	assert.EqualValues(t, 1, c.CurrencyID)
	assert.Equal(t, "128000.00", c.Amount)
	assert.Equal(t, &card.ID, c.ToBankAccountID)
	assert.Equal(t, ptr("Karta"), c.ToAccountName)
	assert.Equal(t, ptr(int64(2)), c.ToCurrencyID)
	assert.Equal(t, ptr("10.00"), c.ToAmount)
	assert.Equal(t, ptr("12800.0000"), c.Rate, "so'm per dollar: what left over what arrived, the so'm leaving")
	assert.Equal(t, ptr("Dollar oldik"), c.Note)
	assert.Equal(t, stored{kind: "conversion", number: 1, account: cash, total: "128000.00", currency: "1", createdBy: ali}, storedOf(t, pool, c.ID))
	target, toTotal := targetOf(t, pool, c.ID)
	assert.Equal(t, card.ID, target)
	assert.Equal(t, "10.00", toTotal)
	back, err := s.AddConversion(ctx, olma, ali, ConversionInput{FromAccountID: card.ID, Amount: ptr("10"), ToAccountID: cash, ToAmount: ptr("127000"), At: at})
	require.NoError(t, err)
	assert.EqualValues(t, 2, back.Number)
	assert.Equal(t, ptr("12700.0000"), back.Rate, "so'm per dollar: what arrived over what left, the so'm arriving")

	for name, tc := range map[string]struct {
		in      ConversionInput
		message string
	}{
		"no account":                  {ConversionInput{Amount: ptr("5"), ToAccountID: card.ID, ToAmount: ptr("1"), At: at}, "Akkauntni tanlang"},
		"no target":                   {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAmount: ptr("1"), At: at}, "Maqsad akkauntni tanlang"},
		"the same account":            {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: cash, ToAmount: ptr("1"), At: at}, "Maqsad akkaunt boshqa bo'lsin"},
		"the same currency":           {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: kassa2.ID, ToAmount: ptr("5"), At: at}, "Bir xil valyutada o'tkazma kiriting"},
		"no moment":                   {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: card.ID, ToAmount: ptr("1")}, "Vaqtni kiriting"},
		"no amount":                   {ConversionInput{FromAccountID: cash, ToAccountID: card.ID, ToAmount: ptr("1"), At: at}, "Summani kiriting"},
		"the amount before the other": {ConversionInput{FromAccountID: cash, ToAccountID: card.ID, At: at}, "Summani kiriting"},
		"no amount arriving":          {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: card.ID, At: at}, "Maqsad summani kiriting"},
		"nothing arriving":            {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: card.ID, ToAmount: ptr("0"), At: at}, "Maqsad summa noto'g'ri"},
		"a long note":                 {ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: card.ID, ToAmount: ptr("1"), At: at, Note: ptr(strings.Repeat("a", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.AddConversion(ctx, olma, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}

	saved, err := s.UpdateConversion(ctx, olma, ali, c.ID, ConversionInput{FromAccountID: cash, Amount: ptr("130000"), ToAccountID: card.ID, ToAmount: ptr("10"), At: at})
	require.NoError(t, err)
	assert.EqualValues(t, 1, saved.Number)
	assert.Equal(t, "130000.00", saved.Amount)
	assert.Equal(t, ptr("10.00"), saved.ToAmount)
	assert.Equal(t, ptr("13000.0000"), saved.Rate, "the rate follows the amounts")
	_, toTotal = targetOf(t, pool, c.ID)
	assert.Equal(t, "10.00", toTotal)
	_, err = s.UpdateConversion(ctx, olma, ali, c.ID, ConversionInput{FromAccountID: cash, Amount: ptr("130000"), ToAccountID: kassa2.ID, ToAmount: ptr("10"), At: at})
	refused(t, err, apperr.Invalid, "validation_error", "Bir xil valyutada o'tkazma kiriting", "turned into a transfer")
	_, err = s.UpdateConversion(ctx, olma, ali, 999_999, ConversionInput{FromAccountID: cash, Amount: ptr("5"), ToAccountID: card.ID, ToAmount: ptr("1"), At: at})
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "unknown")

	page, err := s.ListDocuments(ctx, olma, ListInput{Kinds: []ledger.Kind{ledger.MoneyTransfer, ledger.Conversion}, Page: 1})
	require.NoError(t, err)
	assert.Equal(t, []int64{back.ID, c.ID}, idsOfDocuments(page.Items), "the newest first")
	require.NoError(t, s.DeleteDocument(ctx, olma, c.ID, ledger.Conversion))
	_, err = s.GetDocument(ctx, olma, c.ID, ledger.Conversion)
	refused(t, err, apperr.NotFound, "not_found", "Hujjat topilmadi", "deleted")
}

// addSupplierPayment enters a supplier and a payment to them out of the
// account, straight into the journal.
func addSupplierPayment(t *testing.T, pool *pgxpool.Pool, companyID, accountID int64, name, amount, at string) int64 {
	t.Helper()
	ctx := t.Context()
	var supplier, rate, id int64
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO suppliers (company_id, name, created_by) VALUES ($1, $2, $3) RETURNING id", companyID, name, ali).Scan(&supplier))
	require.NoError(t, pool.QueryRow(ctx, "SELECT id FROM currency_rates WHERE company_id = $1 ORDER BY id LIMIT 1", companyID).Scan(&rate))
	require.NoError(t, pool.QueryRow(ctx, `INSERT INTO transactions (company_id, kind, number, doc_at, supplier_id, bank_account_id, currency_id, currency_rate_id, total, created_by)
		VALUES ($1, 'supplier_payment', 1, $2::timestamptz, $3, $4, 1, $5, $6::numeric, $7) RETURNING id`, companyID, at, supplier, accountID, rate, amount, ali).Scan(&id))
	return id
}

func TestAccountBalancesAndStatement(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	cash := cashOf(t, pool, olma)
	turnOn(t, pool, olma, 2)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)
	kassa2, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Kassa 2", CurrencyID: 1})
	require.NoError(t, err)
	ijara, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Ijara", Kind: KindExpense})
	require.NoError(t, err)
	boshqa, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Boshqa kirim", Kind: KindIncome})
	require.NoError(t, err)
	opening, err := s.AddCashOpening(ctx, olma, ali, CashOpeningInput{BankAccountID: cash, Amount: ptr("1000000"), At: "2026-10-01T10:00:00+05:00"})
	require.NoError(t, err)
	income, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindIncome, BankAccountID: cash, CategoryID: boshqa.ID, Amount: ptr("200000"), At: "2026-10-02T10:00:00+05:00"})
	require.NoError(t, err)
	rent, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("150000"), At: "2026-10-03T10:00:00+05:00", Note: ptr("Oktabr")})
	require.NoError(t, err)
	paid := addSupplierPayment(t, pool, olma, cash, "Bozor", "50000", "2026-10-04 10:00+05")
	moved, err := s.AddMoneyTransfer(ctx, olma, ali, MoneyTransferInput{FromAccountID: cash, ToAccountID: kassa2.ID, Amount: ptr("100000"), At: "2026-10-05T10:00:00+05:00"})
	require.NoError(t, err)
	converted, err := s.AddConversion(ctx, olma, ali, ConversionInput{FromAccountID: cash, Amount: ptr("128000"), ToAccountID: card.ID, ToAmount: ptr("10"), At: "2026-10-06T10:00:00+05:00"})
	require.NoError(t, err)
	gone, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("999"), At: "2026-10-06T12:00:00+05:00"})
	require.NoError(t, err)
	require.NoError(t, s.DeleteDocument(ctx, olma, gone.ID, ledger.Expense))

	balances, err := s.AccountBalances(ctx, olma)
	require.NoError(t, err)
	require.Len(t, balances, 3)
	assert.Equal(t, "Naqd", balances[0].Name)
	assert.Equal(t, "772000.00", balances[0].Balance, "1 000 000 + 200 000 − 150 000 − 50 000 − 100 000 − 128 000")
	assert.Equal(t, "Karta", balances[1].Name)
	assert.Equal(t, "10.00", balances[1].Balance)
	assert.EqualValues(t, 2, balances[1].CurrencyID)
	assert.True(t, balances[1].Active)
	assert.Equal(t, "Kassa 2", balances[2].Name)
	assert.Equal(t, "100000.00", balances[2].Balance)

	page, err := s.AccountStatement(ctx, olma, cash, 1)
	require.NoError(t, err)
	require.Len(t, page.Items, 6)
	assert.EqualValues(t, 6, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, ledger.PageSize, page.PageSize)
	rows := page.Items
	assert.Equal(t, converted.ID, rows[0].ID)
	assert.Equal(t, ledger.Conversion, rows[0].Kind)
	assert.EqualValues(t, 1, rows[0].Number)
	assert.Equal(t, "-128000.00", rows[0].Delta)
	assert.Equal(t, "772000.00", rows[0].Balance)
	assert.Equal(t, ptr("Karta"), rows[0].PartyName, "the account it went to")
	assert.Equal(t, moved.ID, rows[1].ID)
	assert.Equal(t, "-100000.00", rows[1].Delta)
	assert.Equal(t, "900000.00", rows[1].Balance)
	assert.Equal(t, ptr("Kassa 2"), rows[1].PartyName)
	assert.Equal(t, paid, rows[2].ID)
	assert.Equal(t, ledger.SupplierPayment, rows[2].Kind)
	assert.Equal(t, "-50000.00", rows[2].Delta)
	assert.Equal(t, "1000000.00", rows[2].Balance)
	assert.Equal(t, ptr("Bozor"), rows[2].PartyName, "the supplier")
	assert.Equal(t, rent.ID, rows[3].ID)
	assert.Equal(t, "-150000.00", rows[3].Delta)
	assert.Equal(t, ptr("Ijara"), rows[3].PartyName, "the category")
	assert.Equal(t, ptr("Oktabr"), rows[3].Note)
	assert.Equal(t, income.ID, rows[4].ID)
	assert.Equal(t, "200000.00", rows[4].Delta)
	assert.Equal(t, ptr("Boshqa kirim"), rows[4].PartyName)
	assert.Equal(t, opening.ID, rows[5].ID)
	assert.Equal(t, "1000000.00", rows[5].Delta)
	assert.Equal(t, "1000000.00", rows[5].Balance)
	assert.Nil(t, rows[5].PartyName, "an opening balance has no other side")
	assert.Equal(t, ptr("Ali aka"), rows[5].CreatedByName)
	assert.Equal(t, "2026-10-01T05:00:00Z", rows[5].At.UTC().Format(time.RFC3339))

	page, err = s.AccountStatement(ctx, olma, card.ID, 1)
	require.NoError(t, err)
	require.Len(t, page.Items, 1, "the card: the conversion alone, as its target")
	assert.Equal(t, "10.00", page.Items[0].Delta)
	assert.Equal(t, "10.00", page.Items[0].Balance)
	assert.Equal(t, ptr("Naqd"), page.Items[0].PartyName, "the account it came from")
	_, err = s.AccountStatement(ctx, olma, cash, 0)
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri", "page 0")
	_, err = s.AccountStatement(ctx, olma, 999_999, 1)
	refused(t, err, apperr.NotFound, "not_found", "Akkaunt topilmadi", "unknown")
	_, err = s.AccountStatement(ctx, nok, cash, 1)
	refused(t, err, apperr.NotFound, "not_found", "Akkaunt topilmadi", "another company's")
}

// An account that live documents name is neither deleted nor put in
// another currency (logic/finance.md, section 3); it may be renamed and
// turned off. Once its documents are gone, it may.
func TestAccountInUse(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	cash := cashOf(t, pool, olma)
	turnOn(t, pool, olma, 2)
	turnOn(t, pool, olma, 3)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 2})
	require.NoError(t, err)
	c, err := s.AddConversion(ctx, olma, ali, ConversionInput{FromAccountID: cash, Amount: ptr("128000"), ToAccountID: card.ID, ToAmount: ptr("10"), At: "2026-10-06T10:00:00+05:00"})
	require.NoError(t, err)

	_, err = s.UpdateAccount(ctx, olma, card.ID, AccountPatch{CurrencyID: ptr(int64(3))})
	refused(t, err, apperr.Conflict, "account_in_use", "Bu akkauntda 1 ta hujjat bor", "a target of a document")
	_, err = s.UpdateAccount(ctx, olma, cash, AccountPatch{CurrencyID: ptr(int64(2))})
	refused(t, err, apperr.Conflict, "account_in_use", "Bu akkauntda 1 ta hujjat bor", "a source of a document")
	renamed, err := s.UpdateAccount(ctx, olma, card.ID, AccountPatch{Name: ptr("Humo"), CurrencyID: ptr(int64(2))})
	require.NoError(t, err, "the same currency is no change")
	assert.Equal(t, "Humo", renamed.Name)
	off, err := s.UpdateAccount(ctx, olma, card.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err, "turned off instead")
	assert.False(t, off.Active)
	err = s.DeleteAccount(ctx, olma, card.ID)
	refused(t, err, apperr.Conflict, "account_in_use", "Bu akkauntda 1 ta hujjat bor", "not deleted")

	require.NoError(t, s.DeleteDocument(ctx, olma, c.ID, ledger.Conversion))
	_, err = s.UpdateAccount(ctx, olma, card.ID, AccountPatch{CurrencyID: ptr(int64(3))})
	require.NoError(t, err, "a deleted document does not count")
	require.NoError(t, s.DeleteAccount(ctx, olma, card.ID))
}

// A category that live documents are filed under is not deleted
// (logic/finance.md, section 6); it may be turned off.
func TestCategoryInUse(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	cash := cashOf(t, pool, olma)
	ijara, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Ijara", Kind: KindExpense})
	require.NoError(t, err)
	rent, err := s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("150000"), At: "2026-10-03T10:00:00+05:00"})
	require.NoError(t, err)
	_, err = s.AddExpense(ctx, olma, ali, ExpenseInput{Kind: KindExpense, BankAccountID: cash, CategoryID: ijara.ID, Amount: ptr("5"), At: "2026-10-03T11:00:00+05:00"})
	require.NoError(t, err)

	err = s.DeleteCategory(ctx, olma, ijara.ID)
	refused(t, err, apperr.Conflict, "category_in_use", "Bu kategoriyada 2 ta hujjat bor", "filed under")
	off, err := s.UpdateCategory(ctx, olma, ijara.ID, CategoryPatch{Active: ptr(false)})
	require.NoError(t, err, "turned off instead")
	assert.False(t, off.Active)
	require.NoError(t, s.DeleteDocument(ctx, olma, rent.ID, ledger.Expense))
	err = s.DeleteCategory(ctx, olma, ijara.ID)
	refused(t, err, apperr.Conflict, "category_in_use", "Bu kategoriyada 1 ta hujjat bor", "one left")
}
