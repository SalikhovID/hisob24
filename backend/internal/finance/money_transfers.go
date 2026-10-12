package finance

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// MoneyTransferInput is a transfer between two accounts as the client sent
// it (logic/finance.md, section 5): the account it leaves, the one it
// arrives in (another one, in the same currency), the amount, the moment,
// a note.
type MoneyTransferInput struct {
	FromAccountID int64
	ToAccountID   int64
	Amount        *string
	At            string
	Note          *string
}

// targetFor reads the account a document goes to: one of the company's
// («Maqsad akkauntni tanlang» otherwise), another than the one it leaves
// («Maqsad akkaunt boshqa bo'lsin»), active unless it is one the document
// already names, kept («Maqsad akkaunt nofaol»).
func targetFor(ctx context.Context, q *gen.Queries, companyID int64, source gen.BankAccount, id int64, kept []int64) (gen.BankAccount, error) {
	if id == 0 {
		return gen.BankAccount{}, invalid("Maqsad akkauntni tanlang")
	}
	target, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.BankAccount{}, invalid("Maqsad akkauntni tanlang")
	}
	if err != nil {
		return gen.BankAccount{}, err
	}
	if target.ID == source.ID {
		return gen.BankAccount{}, invalid("Maqsad akkaunt boshqa bo'lsin")
	}
	if !target.IsActive && !ledger.Kept(target.ID, kept) {
		return gen.BankAccount{}, invalid("Maqsad akkaunt nofaol")
	}
	return target, nil
}

// checkTransfer reads a transfer: the head with the target between the
// account and the moment, the two in one currency. kept is the accounts
// the document already names, in either role, on an edit.
func checkTransfer(ctx context.Context, q *gen.Queries, companyID int64, by string, in MoneyTransferInput, kept []int64) (head, int64, error) {
	var targetID int64
	h, err := checkHead(ctx, q, companyID, by, in.FromAccountID, kept, in.At, in.Amount, in.Note, func(source gen.BankAccount) error {
		target, err := targetFor(ctx, q, companyID, source, in.ToAccountID, kept)
		if err != nil {
			return err
		}
		if target.CurrencyID != source.CurrencyID {
			return invalid("Valyutalar farq qilsa konvertatsiya kiriting")
		}
		targetID = target.ID
		return nil
	}, nil)
	if err != nil {
		return head{}, 0, err
	}
	return h, targetID, nil
}

// AddMoneyTransfer moves money from one account to another in the same
// currency, as the member with phone by. What is wrong is told in this
// order: the account, the account it goes to, the moment, the amount, the
// note.
func (s *Service) AddMoneyTransfer(ctx context.Context, companyID int64, by string, in MoneyTransferInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		h, targetID, err := checkTransfer(ctx, q, companyID, by, in, nil)
		if err != nil {
			return err
		}
		d, err = enter(ctx, q, companyID, by, ledger.MoneyTransfer, h, func(p *gen.CreateTransactionParams) { p.ToBankAccountID = &targetID })
		return err
	})
	return d, err
}

// UpdateMoneyTransfer saves a transfer with other fields, as the member
// with phone by; its number stays. The document comes first: one that is
// not there is not found.
func (s *Service) UpdateMoneyTransfer(ctx context.Context, companyID int64, by string, id int64, in MoneyTransferInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getDocument(ctx, q, companyID, id, []ledger.Kind{ledger.MoneyTransfer})
		if err != nil {
			return err
		}
		h, targetID, err := checkTransfer(ctx, q, companyID, by, in, accountsOf(was))
		if err != nil {
			return err
		}
		d, err = save(ctx, q, companyID, id, ledger.MoneyTransfer, h, pgtype.Numeric{}, func(p *gen.UpdateTransactionParams) { p.ToBankAccountID = &targetID })
		return err
	})
	return d, err
}

// accountsOf is the accounts a document names, in either role.
func accountsOf(d Document) []int64 {
	kept := []int64{d.BankAccountID}
	if d.ToBankAccountID != nil {
		kept = append(kept, *d.ToBankAccountID)
	}
	return kept
}
