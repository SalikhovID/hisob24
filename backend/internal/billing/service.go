package billing

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Service records payments.
type Service struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

// NewService wires the billing service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: gen.New(pool)}
}

// ExtendInput is one payment: Amount and Note may be empty.
type ExtendInput struct {
	Days   int
	Amount string
	Note   string
}

// Extend pays for in.Days more in one transaction: the company row is
// locked, the new end date computed with NewEndDate from the database's
// today, the company updated and the payment recorded.
func (s *Service) Extend(ctx context.Context, companyID int64, in ExtendInput, adminID int64) (gen.Billing, error) {
	var amount pgtype.Numeric
	if in.Amount != "" {
		if err := amount.Scan(in.Amount); err != nil {
			return gen.Billing{}, err
		}
	}
	var note *string
	if n := strings.TrimSpace(in.Note); n != "" {
		note = &n
	}

	var b gen.Billing
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		row, err := q.LockCompanyEndDate(ctx, companyID)
		if err != nil {
			return err
		}
		newEnd := NewEndDate(row.EndDate, row.Today, in.Days)
		if err := q.SetCompanyEndDate(ctx, gen.SetCompanyEndDateParams{ID: companyID, EndDate: newEnd}); err != nil {
			return err
		}
		b, err = q.CreateBilling(ctx, gen.CreateBillingParams{
			CompanyID:   companyID,
			Days:        int32(in.Days),
			Amount:      amount,
			PrevEndDate: row.EndDate,
			NewEndDate:  newEnd,
			Note:        note,
			CreatedBy:   &adminID,
		})
		return err
	})
	return b, err
}

// History lists a company's payments, newest first.
func (s *Service) History(ctx context.Context, companyID int64) ([]gen.Billing, error) {
	return nil, errors.New("not implemented")
}
