package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// AccountBalance is an account with what it holds, in its own currency
// (logic/finance.md, section 4).
type AccountBalance struct {
	Account
	Balance string
}

// StatementRow is one row of an account's statement: a document that
// named the account, how it changed what the account holds (in the
// account's currency) and what the account held after it; the other side
// (the supplier or the customer, the category, the other account); the
// document a payment was entered with, and the order when that document
// is an order's (logic/orders.md, 4.3).
type StatementRow struct {
	ID            int64
	Kind          ledger.Kind
	Number        int32
	At            time.Time
	Delta         string
	Balance       string
	LinkedID      *int64
	LinkedNumber  *int32
	OrderID       *int64
	OrderNumber   *int32
	PartyName     *string
	Note          *string
	CreatedByName *string
}

// StatementPage is one page of an account's statement.
type StatementPage struct {
	Items    []StatementRow
	Total    int64
	Page     int
	PageSize int
}

// AccountBalances is the company's live accounts, the active first and then
// in the order added, each with what it holds.
func (s *Service) AccountBalances(ctx context.Context, companyID int64) ([]AccountBalance, error) {
	rows, err := s.q.ListAccountBalances(ctx, companyID)
	if err != nil {
		return nil, err
	}
	list := make([]AccountBalance, 0, len(rows))
	for _, r := range rows {
		list = append(list, AccountBalance{Account: Account{ID: r.ID, Name: r.Name, CurrencyID: r.CurrencyID, Active: r.IsActive}, Balance: amountOf(r.Balance)})
	}
	return list, nil
}

// partyOf is the other side of a statement row: the supplier, the customer
// (by name, or by phone with no name answered), the category, the other
// account; none for an opening balance of the cash.
func partyOf(r gen.ListAccountStatementRow) *string {
	switch {
	case r.SupplierName != nil:
		return r.SupplierName
	case r.CustomerName != nil && *r.CustomerName != "":
		return r.CustomerName
	case r.CustomerPhone != nil:
		return r.CustomerPhone
	case r.CategoryName != nil:
		return r.CategoryName
	}
	return r.OtherAccountName
}

// AccountStatement is a page of the account's statement, the newest row
// first. The account comes first: one that is not the company's live one
// is not found.
func (s *Service) AccountStatement(ctx context.Context, companyID, accountID int64, page int) (StatementPage, error) {
	if err := ledger.PageOf(page); err != nil {
		return StatementPage{}, err
	}
	if _, err := s.q.GetAccountBalance(ctx, gen.GetAccountBalanceParams{ID: accountID, CompanyID: companyID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StatementPage{}, errAccountNotFound
		}
		return StatementPage{}, err
	}
	total, err := s.q.CountAccountStatement(ctx, gen.CountAccountStatementParams{CompanyID: companyID, AccountID: accountID})
	if err != nil {
		return StatementPage{}, err
	}
	rows, err := s.q.ListAccountStatement(ctx, gen.ListAccountStatementParams{CompanyID: companyID, AccountID: accountID, Limit: ledger.PageSize, Offset: int32((page - 1) * ledger.PageSize)})
	if err != nil {
		return StatementPage{}, err
	}
	items := make([]StatementRow, 0, len(rows))
	for _, r := range rows {
		items = append(items, StatementRow{
			ID: r.ID, Kind: ledger.Kind(r.Kind), Number: r.Number, At: r.DocAt.UTC(), Delta: amountOf(r.Delta), Balance: amountOf(r.Balance),
			LinkedID: r.LinkedID, LinkedNumber: r.LinkedNumber, OrderID: r.OrderID, OrderNumber: r.OrderNumber, PartyName: partyOf(r), Note: r.Note, CreatedByName: r.CreatedByName,
		})
	}
	return StatementPage{Items: items, Total: total, Page: page, PageSize: ledger.PageSize}, nil
}
