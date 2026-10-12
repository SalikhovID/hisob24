package finance

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/ledger"
)

// ConversionInput is a conversion as the client sent it (logic/finance.md,
// section 5): the account it leaves and the amount that leaves (in that
// account's currency), the account it arrives in (another one, in another
// currency) and the amount that arrives (in that one's), the moment, a
// note.
type ConversionInput struct {
	FromAccountID int64
	Amount        *string
	ToAccountID   int64
	ToAmount      *string
	At            string
	Note          *string
}

// arrivingAmount reads the amount a conversion arrives with: one is needed
// («Maqsad summani kiriting»), above zero, two decimals at most («Maqsad
// summa noto'g'ri»).
func arrivingAmount(raw *string) (pgtype.Numeric, error) {
	if raw == nil || *raw == "" {
		return pgtype.Numeric{}, invalid("Maqsad summani kiriting")
	}
	n, err := catalog.Money(raw, "Maqsad summa noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if catalog.Zero(n) {
		return pgtype.Numeric{}, invalid("Maqsad summa noto'g'ri")
	}
	return n, nil
}

// checkConversion reads a conversion: the head with the target between the
// account and the moment, the two in different currencies, and the amount
// that arrives after the amount that leaves. kept is the accounts the
// document already names, in either role, on an edit.
func checkConversion(ctx context.Context, q *gen.Queries, companyID int64, by string, in ConversionInput, kept []int64) (head, int64, pgtype.Numeric, error) {
	var targetID int64
	var arriving pgtype.Numeric
	h, err := checkHead(ctx, q, companyID, by, in.FromAccountID, kept, in.At, in.Amount, in.Note, func(source gen.BankAccount) error {
		target, err := targetFor(ctx, q, companyID, source, in.ToAccountID, kept)
		if err != nil {
			return err
		}
		if target.CurrencyID == source.CurrencyID {
			return invalid("Bir xil valyutada o'tkazma kiriting")
		}
		targetID = target.ID
		return nil
	}, func() error {
		var err error
		arriving, err = arrivingAmount(in.ToAmount)
		return err
	})
	if err != nil {
		return head{}, 0, pgtype.Numeric{}, err
	}
	return h, targetID, arriving, nil
}

// AddConversion turns money of one account into money of another, in
// another currency, as the member with phone by. What is wrong is told in
// this order: the account, the account it goes to, the moment, the amount,
// the amount that arrives, the note.
func (s *Service) AddConversion(ctx context.Context, companyID int64, by string, in ConversionInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		h, targetID, arriving, err := checkConversion(ctx, q, companyID, by, in, nil)
		if err != nil {
			return err
		}
		d, err = enter(ctx, q, companyID, by, ledger.Conversion, h, func(p *gen.CreateTransactionParams) {
			p.ToBankAccountID = &targetID
			p.ToTotal = arriving
		})
		return err
	})
	return d, err
}

// UpdateConversion saves a conversion with other fields, as the member
// with phone by; its number stays. The document comes first: one that is
// not there is not found.
func (s *Service) UpdateConversion(ctx context.Context, companyID int64, by string, id int64, in ConversionInput) (Document, error) {
	var d Document
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		was, err := getDocument(ctx, q, companyID, id, []ledger.Kind{ledger.Conversion})
		if err != nil {
			return err
		}
		h, targetID, arriving, err := checkConversion(ctx, q, companyID, by, in, accountsOf(was))
		if err != nil {
			return err
		}
		d, err = save(ctx, q, companyID, id, ledger.Conversion, h, arriving, func(p *gen.UpdateTransactionParams) { p.ToBankAccountID = &targetID })
		return err
	})
	return d, err
}
