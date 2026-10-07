package company

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// CreateInput is a new company and its owner.
type CreateInput struct {
	Name          string
	EndDate       time.Time
	OwnerPhone    string
	OwnerFullName string
}

// Create adds a company with its owner in one transaction: the company row,
// the owner's user row (an existing user is reused unchanged), the owner
// membership, under the name the owner goes by in this company, and what
// every company starts with: the customer types, the task settings and the
// location "Asosiy".
func (s *Service) Create(ctx context.Context, in CreateInput, adminID int64) (Company, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Company{}, invalid("Kompaniya nomini kiriting")
	}
	phone, err := user.NormalizePhone(in.OwnerPhone)
	if err != nil {
		return Company{}, invalid("Egasining telefon raqami noto'g'ri")
	}
	ownerName := strings.TrimSpace(in.OwnerFullName)
	if ownerName == "" {
		return Company{}, invalid("Egasining ismini kiriting")
	}

	var created Company
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		c, err := q.CreateCompany(ctx, gen.CreateCompanyParams{Name: name, EndDate: in.EndDate, CreatedBy: &adminID})
		if err != nil {
			return err
		}
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: phone, FullName: &ownerName}); err != nil {
			return err
		}
		if _, err := q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: phone, CompanyID: c.ID, Role: "owner", FullName: &ownerName}); err != nil {
			return err
		}
		// Every company starts with the ready customer types (logic/customers.md)
		// and the ready task stages and type (logic/tasks.md).
		if err := q.SeedCustomerTypes(ctx, c.ID); err != nil {
			return err
		}
		if err := q.SeedTaskSettings(ctx, c.ID); err != nil {
			return err
		}
		// And the location its tasks stand in (logic/locations.md).
		if _, err := q.SeedLocation(ctx, c.ID); err != nil {
			return err
		}
		today, err := q.CurrentDate(ctx)
		if err != nil {
			return err
		}
		created = withDaysLeft(c, today)
		return nil
	})
	return created, err
}
