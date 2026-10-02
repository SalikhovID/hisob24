package billing

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// MaxDays bounds one payment: ten years, well inside the date range.
const MaxDays = 3650

var amountPattern = regexp.MustCompile(`^\d{1,12}(\.\d{1,2})?$`)

var errCompanyNotFound = apperr.New(apperr.NotFound, "not_found", "Kompaniya topilmadi")

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
	if in.Days < 1 || in.Days > MaxDays {
		return gen.Billing{}, apperr.New(apperr.Invalid, "validation_error", "Kunlar soni 1 dan 3650 gacha bo'lishi kerak")
	}
	var amount pgtype.Numeric
	if in.Amount != "" {
		if !amountPattern.MatchString(in.Amount) || amount.Scan(in.Amount) != nil {
			return gen.Billing{}, apperr.New(apperr.Invalid, "validation_error", "Summa noto'g'ri: masalan 150000 yoki 150000.50")
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
		if errors.Is(err, pgx.ErrNoRows) {
			return errCompanyNotFound
		}
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
	if _, err := s.q.GetCompany(ctx, companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errCompanyNotFound
		}
		return nil, err
	}
	return s.q.ListBillings(ctx, companyID)
}
