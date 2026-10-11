package finance

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

var (
	errAccountNotFound  = apperr.New(apperr.NotFound, "not_found", "Akkaunt topilmadi")
	errAccountNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli akkaunt allaqachon bor")
	errLastAccount      = apperr.New(apperr.Conflict, "last_account", "Kompaniyada kamida bitta faol akkaunt qolsin")
)

// Account is an account of a company (logic/finance.md, section 3): where
// some of its money sits, in one currency; off (not Active) it is offered
// to no new document.
type Account struct {
	ID         int64
	Name       string
	CurrencyID int64
	Active     bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// AccountInput is a new account as the admin sent it.
type AccountInput struct {
	Name       string
	CurrencyID int64
}

// AccountPatch is a change of an account: each field given replaces the
// account's, one left out (nil) stays.
type AccountPatch struct {
	Name       *string
	CurrencyID *int64
	Active     *bool
}

func toAccount(a gen.BankAccount) Account {
	return Account{ID: a.ID, Name: a.Name, CurrencyID: a.CurrencyID, Active: a.IsActive, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt}
}

// Accounts is the company's live accounts, in the order they were added.
func (s *Service) Accounts(ctx context.Context, companyID int64) ([]Account, error) {
	rows, err := s.q.ListBankAccounts(ctx, companyID)
	if err != nil {
		return nil, err
	}
	list := make([]Account, 0, len(rows))
	for _, r := range rows {
		list = append(list, toAccount(r))
	}
	return list, nil
}

// AddAccount adds an account to the company, as the admin: the name
// trimmed, 1–60 characters, one account's in the company (whatever the
// case; a deleted account's name is free); the currency one the company
// has on.
func (s *Service) AddAccount(ctx context.Context, companyID, adminID int64, in AccountInput) (Account, error) {
	name, err := fields.CleanName(in.Name)
	if err != nil {
		return Account{}, err
	}
	var added Account
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		if err := currencyAllowed(ctx, q, companyID, in.CurrencyID); err != nil {
			return err
		}
		a, err := q.CreateBankAccount(ctx, gen.CreateBankAccountParams{CompanyID: companyID, Name: name, CurrencyID: in.CurrencyID, CreatedBy: &adminID})
		if fields.Taken(err) {
			return errAccountNameTaken
		}
		if err != nil {
			return err
		}
		added = toAccount(a)
		return nil
	})
	return added, err
}

// UpdateAccount changes the company's account as the patch says: the name
// and the currency under the rules of AddAccount; turning the last active
// account off is refused (409 last_account).
func (s *Service) UpdateAccount(ctx context.Context, companyID, id int64, patch AccountPatch) (Account, error) {
	var name *string
	if patch.Name != nil {
		cleaned, err := fields.CleanName(*patch.Name)
		if err != nil {
			return Account{}, err
		}
		name = &cleaned
	}
	var updated Account
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errAccountNotFound
		}
		if err != nil {
			return err
		}
		if patch.CurrencyID != nil {
			if err := currencyAllowed(ctx, q, companyID, *patch.CurrencyID); err != nil {
				return err
			}
		}
		if patch.Active != nil && !*patch.Active && was.IsActive {
			if err := anotherActive(ctx, q, companyID); err != nil {
				return err
			}
		}
		a, err := q.UpdateBankAccount(ctx, gen.UpdateBankAccountParams{ID: id, CompanyID: companyID, Name: name, CurrencyID: patch.CurrencyID, IsActive: patch.Active})
		if fields.Taken(err) {
			return errAccountNameTaken
		}
		if err != nil {
			return err
		}
		updated = toAccount(a)
		return nil
	})
	return updated, err
}

// DeleteAccount hides the company's account; its name is free again. The
// last active account is not deleted (409 last_account).
func (s *Service) DeleteAccount(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errAccountNotFound
		}
		if err != nil {
			return err
		}
		if was.IsActive {
			if err := anotherActive(ctx, q, companyID); err != nil {
				return err
			}
		}
		_, err = q.DeleteBankAccount(ctx, gen.DeleteBankAccountParams{ID: id, CompanyID: companyID})
		return err
	})
}

// anotherActive refuses to lose an active account when it is the last one.
func anotherActive(ctx context.Context, q *gen.Queries, companyID int64) error {
	active, err := q.CountActiveBankAccounts(ctx, companyID)
	if err != nil {
		return err
	}
	if active <= 1 {
		return errLastAccount
	}
	return nil
}
