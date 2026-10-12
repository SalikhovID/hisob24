package finance

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// CashOpeningInput is an opening balance of the cash as the client sent it
// (logic/finance.md, section 5): the account, the amount in its currency,
// the moment, a note.
type CashOpeningInput struct {
	BankAccountID int64
	Amount        *string
	At            string
	Note          *string
}

// AddCashOpening enters what an account held when the books began, as the
// member with phone by. What is wrong is told in this order: the account,
// the moment, the amount, the note.
func (s *Service) AddCashOpening(ctx context.Context, companyID int64, by string, in CashOpeningInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		h, err := checkHead(ctx, q, companyID, by, in.BankAccountID, 0, in.At, in.Amount, in.Note, nil)
		if err != nil {
			return err
		}
		d, err = enter(ctx, q, companyID, by, ledger.CashOpening, h, nil)
		return err
	})
	return d, err
}

// UpdateCashOpening saves an opening balance of the cash with other fields,
// as the member with phone by; its number stays. The document comes first:
// one that is not there is not found.
func (s *Service) UpdateCashOpening(ctx context.Context, companyID int64, by string, id int64, in CashOpeningInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getDocument(ctx, q, companyID, id, []ledger.Kind{ledger.CashOpening})
		if err != nil {
			return err
		}
		h, err := checkHead(ctx, q, companyID, by, in.BankAccountID, was.BankAccountID, in.At, in.Amount, in.Note, nil)
		if err != nil {
			return err
		}
		d, err = save(ctx, q, companyID, id, ledger.CashOpening, h, pgtype.Numeric{}, nil)
		return err
	})
	return d, err
}
