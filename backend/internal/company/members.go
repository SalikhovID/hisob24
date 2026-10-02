package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var roles = map[string]bool{"owner": true, "manager": true, "staff": true}

// AddUser adds a user to the company in one transaction; a user who is
// already a member gets the new role, an existing user keeps the name.
func (s *Service) AddUser(ctx context.Context, companyID int64, phone, fullName, role string) (Member, error) {
	if !roles[role] {
		return Member{}, invalid("Rol owner, manager yoki staff bo'lishi kerak")
	}
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, invalid("Telefon raqami noto'g'ri")
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return Member{}, invalid("Ismni kiriting")
	}

	var m Member
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if _, err := q.GetCompany(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errNotFound
			}
			return err
		}
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
			return err
		}
		uc, err := q.UpsertCompanyUser(ctx, gen.UpsertCompanyUserParams{UserPhone: normalized, CompanyID: companyID, Role: role})
		if err != nil {
			return err
		}
		u, err := q.GetUser(ctx, normalized)
		if err != nil {
			return err
		}
		m = Member{Phone: u.Phone, FullName: u.FullName, Role: uc.Role, CreatedAt: uc.CreatedAt}
		return nil
	})
	return m, err
}
