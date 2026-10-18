package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/finance"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// The cash (logic/finance.md, sections 4 and 5): what the accounts hold
// and their statements; the cash documents: an opening balance of the
// cash, an expense or other income, a transfer between accounts, a
// conversion between currencies.

type accountBalanceJSON struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	CurrencyID int64  `json:"currency_id"`
	IsActive   bool   `json:"is_active"`
	Balance    string `json:"balance"`
}

type accountStatementRowJSON struct {
	ID            int64     `json:"id"`
	Kind          string    `json:"kind"`
	Number        int32     `json:"number"`
	At            time.Time `json:"at"`
	Delta         string    `json:"delta"`
	Balance       string    `json:"balance"`
	LinkedID      *int64    `json:"linked_id"`
	LinkedNumber  *int32    `json:"linked_number"`
	OrderID       *int64    `json:"order_id"`
	OrderNumber   *int32    `json:"order_number"`
	PartyName     *string   `json:"party_name"`
	Note          *string   `json:"note"`
	CreatedByName *string   `json:"created_by_name"`
}

type accountStatementPageJSON struct {
	Items    []accountStatementRowJSON `json:"items"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"page_size"`
}

// cashOpeningJSON is a cash document as the API shows it: the fields every
// kind has. An expense and a transfer add their own.
type cashOpeningJSON struct {
	ID            int64     `json:"id"`
	Number        int32     `json:"number"`
	BankAccountID int64     `json:"bank_account_id"`
	AccountName   string    `json:"account_name"`
	CurrencyID    int64     `json:"currency_id"`
	Amount        string    `json:"amount"`
	At            time.Time `json:"at"`
	Note          *string   `json:"note"`
	CreatedByName *string   `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toCashOpeningJSON(d finance.Document) cashOpeningJSON {
	return cashOpeningJSON{
		ID: d.ID, Number: d.Number, BankAccountID: d.BankAccountID, AccountName: d.AccountName, CurrencyID: d.CurrencyID, Amount: d.Amount,
		At: d.At, Note: d.Note, CreatedByName: d.CreatedByName, CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt,
	}
}

type expenseJSON struct {
	cashOpeningJSON
	Kind         string `json:"kind"`
	CategoryID   int64  `json:"category_id"`
	CategoryName string `json:"category_name"`
}

func toExpenseJSON(d finance.Document) expenseJSON {
	out := expenseJSON{cashOpeningJSON: toCashOpeningJSON(d), Kind: string(d.Kind)}
	if d.CategoryID != nil {
		out.CategoryID = *d.CategoryID
	}
	if d.CategoryName != nil {
		out.CategoryName = *d.CategoryName
	}
	return out
}

// moneyTransferJSON is a transfer or a conversion as the API shows it: the
// account it leaves and the one it arrives in; a conversion the amount
// that arrives and the rate it comes to as well.
type moneyTransferJSON struct {
	ID              int64     `json:"id"`
	Kind            string    `json:"kind"`
	Number          int32     `json:"number"`
	FromAccountID   int64     `json:"from_account_id"`
	FromAccountName string    `json:"from_account_name"`
	CurrencyID      int64     `json:"currency_id"`
	Amount          string    `json:"amount"`
	ToAccountID     int64     `json:"to_account_id"`
	ToAccountName   string    `json:"to_account_name"`
	ToCurrencyID    int64     `json:"to_currency_id"`
	ToAmount        *string   `json:"to_amount"`
	Rate            *string   `json:"rate"`
	At              time.Time `json:"at"`
	Note            *string   `json:"note"`
	CreatedByName   *string   `json:"created_by_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func toMoneyTransferJSON(d finance.Document) moneyTransferJSON {
	out := moneyTransferJSON{
		ID: d.ID, Kind: string(d.Kind), Number: d.Number, FromAccountID: d.BankAccountID, FromAccountName: d.AccountName, CurrencyID: d.CurrencyID, Amount: d.Amount,
		ToAmount: d.ToAmount, Rate: d.Rate, At: d.At, Note: d.Note, CreatedByName: d.CreatedByName, CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt,
	}
	if d.ToBankAccountID != nil {
		out.ToAccountID = *d.ToBankAccountID
	}
	if d.ToAccountName != nil {
		out.ToAccountName = *d.ToAccountName
	}
	if d.ToCurrencyID != nil {
		out.ToCurrencyID = *d.ToCurrencyID
	}
	return out
}

type cashOpeningInputJSON struct {
	BankAccountID int64   `json:"bank_account_id"`
	Amount        *string `json:"amount"`
	At            string  `json:"at"`
	Note          *string `json:"note"`
}

type expenseInputJSON struct {
	Kind          string  `json:"kind"`
	BankAccountID int64   `json:"bank_account_id"`
	CategoryID    int64   `json:"category_id"`
	Amount        *string `json:"amount"`
	At            string  `json:"at"`
	Note          *string `json:"note"`
}

type moneyTransferInputJSON struct {
	FromAccountID int64   `json:"from_account_id"`
	ToAccountID   int64   `json:"to_account_id"`
	Amount        *string `json:"amount"`
	At            string  `json:"at"`
	Note          *string `json:"note"`
}

type conversionInputJSON struct {
	FromAccountID int64   `json:"from_account_id"`
	Amount        *string `json:"amount"`
	ToAccountID   int64   `json:"to_account_id"`
	ToAmount      *string `json:"to_amount"`
	At            string  `json:"at"`
	Note          *string `json:"note"`
}

// cashPageJSON is one page of a list, as every list of the cash tells it.
type cashPageJSON[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

func toCashPageJSON[T any](page finance.DocumentPage, to func(finance.Document) T) cashPageJSON[T] {
	items := make([]T, 0, len(page.Items))
	for _, d := range page.Items {
		items = append(items, to(d))
	}
	return cashPageJSON[T]{Items: items, Total: page.Total, Page: page.Page, PageSize: page.PageSize}
}

// optionalIDParam reads an id from the query (none unless given): one that
// is not a positive number is refused with message, and false is returned.
func optionalIDParam(w http.ResponseWriter, r *http.Request, name, message string) (*int64, bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, http.StatusBadRequest, "validation_error", message)
		return nil, false
	}
	return &id, true
}

// memberZone is the zone the member's days are counted in.
func memberZone(r *http.Request) string {
	if tz := currentAccess(r.Context()).Timezone; tz != "" {
		return tz
	}
	return "Asia/Tashkent"
}

// cashListParams reads what a list of cash documents is narrowed to:
// ?account_id= («Akkaunt noto'g'ri»), ?category_id= («Kategoriya
// noto'g'ri»), ?from= and ?to= as days in the member's zone («Sana
// noto'g'ri»), ?page=.
func cashListParams(w http.ResponseWriter, r *http.Request, kinds ...ledger.Kind) (finance.ListInput, bool) {
	in := finance.ListInput{Kinds: kinds}
	var ok bool
	if in.AccountID, ok = optionalIDParam(w, r, "account_id", "Akkaunt noto'g'ri"); !ok {
		return in, false
	}
	if in.CategoryID, ok = optionalIDParam(w, r, "category_id", "Kategoriya noto'g'ri"); !ok {
		return in, false
	}
	query := r.URL.Query()
	from, to, err := ledger.DayRange(query.Get("from"), query.Get("to"), memberZone(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return in, false
	}
	in.From, in.To = from, to
	if in.Page, ok = pageParam(w, r); !ok {
		return in, false
	}
	return in, true
}

// listAccounts is the company's accounts with what each holds.
func (h *Handler) listAccounts(w http.ResponseWriter, r *http.Request) {
	list, err := h.finance.AccountBalances(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out := make([]accountBalanceJSON, 0, len(list))
	for _, a := range list {
		out = append(out, accountBalanceJSON{ID: a.ID, Name: a.Name, CurrencyID: a.CurrencyID, IsActive: a.Active, Balance: a.Balance})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// getAccountStatement is a page of an account's statement, the newest first.
func (h *Handler) getAccountStatement(w http.ResponseWriter, r *http.Request) {
	page, ok := pageParam(w, r)
	if !ok {
		return
	}
	result, err := h.finance.AccountStatement(r.Context(), sessionCompany(r), pathID(r, "id"), page)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]accountStatementRowJSON, 0, len(result.Items))
	for _, row := range result.Items {
		items = append(items, accountStatementRowJSON{
			ID: row.ID, Kind: string(row.Kind), Number: row.Number, At: row.At, Delta: row.Delta, Balance: row.Balance,
			LinkedID: row.LinkedID, LinkedNumber: row.LinkedNumber, OrderID: row.OrderID, OrderNumber: row.OrderNumber, PartyName: row.PartyName, Note: row.Note, CreatedByName: row.CreatedByName,
		})
	}
	httpx.JSON(w, http.StatusOK, accountStatementPageJSON{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

// listCashOpenings is a page of the opening balances of the cash, the
// newest first; ?account_id= keeps one account's.
func (h *Handler) listCashOpenings(w http.ResponseWriter, r *http.Request) {
	in, ok := cashListParams(w, r, ledger.CashOpening)
	if !ok {
		return
	}
	page, err := h.finance.ListDocuments(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashPageJSON(page, toCashOpeningJSON))
}

func (h *Handler) createCashOpening(w http.ResponseWriter, r *http.Request) {
	var body cashOpeningInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.AddCashOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, finance.CashOpeningInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toCashOpeningJSON(d))
}

func (h *Handler) getCashOpening(w http.ResponseWriter, r *http.Request) {
	d, err := h.finance.GetDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.CashOpening)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashOpeningJSON(d))
}

func (h *Handler) updateCashOpening(w http.ResponseWriter, r *http.Request) {
	var body cashOpeningInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.UpdateCashOpening(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), finance.CashOpeningInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashOpeningJSON(d))
}

func (h *Handler) deleteCashOpening(w http.ResponseWriter, r *http.Request) {
	if err := h.finance.DeleteDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.CashOpening); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// expenseKindParam reads ?kind=: the expenses unless the incomes are asked
// («Tur noto'g'ri» for anything else).
func expenseKindParam(w http.ResponseWriter, r *http.Request) (ledger.Kind, bool) {
	switch r.URL.Query().Get("kind") {
	case "", finance.KindExpense:
		return ledger.Expense, true
	case finance.KindIncome:
		return ledger.Income, true
	}
	httpx.Error(w, http.StatusBadRequest, "validation_error", "Tur noto'g'ri")
	return "", false
}

// listExpenses is a page of the expenses (or, with ?kind=income, the other
// income), the newest first; narrowed to an account, a category and a
// span of days when asked.
func (h *Handler) listExpenses(w http.ResponseWriter, r *http.Request) {
	kind, ok := expenseKindParam(w, r)
	if !ok {
		return
	}
	in, ok := cashListParams(w, r, kind)
	if !ok {
		return
	}
	page, err := h.finance.ListDocuments(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashPageJSON(page, toExpenseJSON))
}

func (h *Handler) createExpense(w http.ResponseWriter, r *http.Request) {
	var body expenseInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.AddExpense(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, finance.ExpenseInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toExpenseJSON(d))
}

func (h *Handler) getExpense(w http.ResponseWriter, r *http.Request) {
	d, err := h.finance.GetDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.Expense, ledger.Income)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toExpenseJSON(d))
}

func (h *Handler) updateExpense(w http.ResponseWriter, r *http.Request) {
	var body expenseInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.UpdateExpense(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), finance.ExpenseInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toExpenseJSON(d))
}

func (h *Handler) deleteExpense(w http.ResponseWriter, r *http.Request) {
	if err := h.finance.DeleteDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.Expense, ledger.Income); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listMoneyTransfers is a page of the transfers and the conversions in one
// list, the newest first; ?account_id= keeps those out of or into one
// account.
func (h *Handler) listMoneyTransfers(w http.ResponseWriter, r *http.Request) {
	in, ok := cashListParams(w, r, ledger.MoneyTransfer, ledger.Conversion)
	if !ok {
		return
	}
	page, err := h.finance.ListDocuments(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashPageJSON(page, toMoneyTransferJSON))
}

func (h *Handler) createMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	var body moneyTransferInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.AddMoneyTransfer(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, finance.MoneyTransferInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toMoneyTransferJSON(d))
}

func (h *Handler) getMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	d, err := h.finance.GetDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.MoneyTransfer)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMoneyTransferJSON(d))
}

func (h *Handler) updateMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	var body moneyTransferInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.UpdateMoneyTransfer(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), finance.MoneyTransferInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMoneyTransferJSON(d))
}

func (h *Handler) deleteMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	if err := h.finance.DeleteDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.MoneyTransfer); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listConversions is a page of the conversions, the newest first.
func (h *Handler) listConversions(w http.ResponseWriter, r *http.Request) {
	in, ok := cashListParams(w, r, ledger.Conversion)
	if !ok {
		return
	}
	page, err := h.finance.ListDocuments(r.Context(), sessionCompany(r), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toCashPageJSON(page, toMoneyTransferJSON))
}

func (h *Handler) createConversion(w http.ResponseWriter, r *http.Request) {
	var body conversionInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.AddConversion(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, finance.ConversionInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toMoneyTransferJSON(d))
}

func (h *Handler) getConversion(w http.ResponseWriter, r *http.Request) {
	d, err := h.finance.GetDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.Conversion)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMoneyTransferJSON(d))
}

func (h *Handler) updateConversion(w http.ResponseWriter, r *http.Request) {
	var body conversionInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	d, err := h.finance.UpdateConversion(r.Context(), sessionCompany(r), currentUser(r.Context()).Phone, pathID(r, "id"), finance.ConversionInput(body))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMoneyTransferJSON(d))
}

func (h *Handler) deleteConversion(w http.ResponseWriter, r *http.Request) {
	if err := h.finance.DeleteDocument(r.Context(), sessionCompany(r), pathID(r, "id"), ledger.Conversion); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
