package ledger

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/catalog"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// Head is the document the payments are entered with: a purchase (its
// supplier is paid), a sale (its customer pays, or nobody for a retail
// sale) or an order's document (its customer pays an advance), at its
// moment.
type Head struct {
	ID         int64
	Kind       Kind
	CompanyID  int64
	SupplierID *int64
	CustomerID *int64
	At         time.Time
}

// PaymentLine is a payment as the client enters it with a document: out of
// (or into) an account, an amount in the account's currency.
type PaymentLine struct {
	BankAccountID int64
	Amount        *string
}

// WriteLinkedPayments writes the payments entered with the document anew
// (logic/warehouse.md, 4.1 and 4.3), as the member with phone by: the ones
// there are hidden, and one payment is entered per line, numbered on,
// linked to the document, at its moment, in the account's currency by the
// rate in force then. What is wrong is told in this order, line by line:
// the account (one of the company's, "Akkauntni tanlang"; active unless the
// document pays from it already, "Akkaunt nofaol"), the amount ("To'lov
// summasi noto'g'ri"), the rate of the account's currency ("Kursni
// kiriting").
func WriteLinkedPayments(ctx context.Context, q *gen.Queries, head Head, lines []PaymentLine, by string, byName *string) error {
	was, err := q.ListLinkedPayments(ctx, head.ID)
	if err != nil {
		return err
	}
	held := make(map[int64]bool, len(was))
	for _, p := range was {
		held[p.BankAccountID] = true
	}
	if err := q.HideLinkedPayments(ctx, head.ID); err != nil {
		return err
	}
	kind := SupplierPayment
	if head.Kind == Sale || head.Kind == Order {
		kind = CustomerPayment
	}
	for _, l := range lines {
		account, err := q.GetBankAccount(ctx, gen.GetBankAccountParams{ID: l.BankAccountID, CompanyID: head.CompanyID})
		if errors.Is(err, pgx.ErrNoRows) || l.BankAccountID == 0 {
			return fields.Invalid("Akkauntni tanlang")
		}
		if err != nil {
			return err
		}
		if !account.IsActive && !held[account.ID] {
			return fields.Invalid("Akkaunt nofaol")
		}
		amount, err := PaymentAmount(l.Amount)
		if err != nil {
			return err
		}
		pricing, err := PriceIn(ctx, q, head.CompanyID, PriceInput{CurrencyID: &account.CurrencyID}, head.At, by, nil)
		if err != nil {
			return err
		}
		number, err := NextNumber(ctx, q, head.CompanyID, kind)
		if err != nil {
			return err
		}
		if _, err := q.CreateTransaction(ctx, gen.CreateTransactionParams{
			CompanyID: head.CompanyID, Kind: string(kind), Number: number, DocAt: head.At, SupplierID: head.SupplierID, CustomerID: head.CustomerID,
			BankAccountID: &account.ID, LinkedID: &head.ID, CurrencyID: pricing.CurrencyID, CurrencyRateID: pricing.RateID, Total: amount,
			CreatedBy: by, CreatedByName: byName,
		}); err != nil {
			return err
		}
	}
	return nil
}

// PaymentAmount reads the amount of a payment line: one above zero, two
// decimals at most ("To'lov summasi noto'g'ri").
func PaymentAmount(raw *string) (pgtype.Numeric, error) {
	n, err := catalog.Money(raw, "To'lov summasi noto'g'ri")
	if err != nil {
		return pgtype.Numeric{}, err
	}
	if catalog.Zero(n) {
		return pgtype.Numeric{}, fields.Invalid("To'lov summasi noto'g'ri")
	}
	return n, nil
}
