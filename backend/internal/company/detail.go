package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Detail is a company with its users.
type Detail struct {
	Company
	Users []Member
}

// Get returns a company and its users.
func (s *Service) Get(ctx context.Context, id int64) (Detail, error) {
	c, err := s.q.GetCompany(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, errNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	users, err := s.Members(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Detail{}, err
	}
	return Detail{Company: withDaysLeft(c, today), Users: users}, nil
}

// Update changes the name and the active flag; a nil argument keeps the
// column as it is.
func (s *Service) Update(ctx context.Context, id int64, name *string, isActive *bool) (Company, error) {
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" {
			return Company{}, invalid("Kompaniya nomini kiriting")
		}
		name = &trimmed
	}
	c, err := s.q.UpdateCompany(ctx, gen.UpdateCompanyParams{ID: id, Name: name, IsActive: isActive})
	if errors.Is(err, pgx.ErrNoRows) {
		return Company{}, errNotFound
	}
	if err != nil {
		return Company{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Company{}, err
	}
	return withDaysLeft(c, today), nil
}
