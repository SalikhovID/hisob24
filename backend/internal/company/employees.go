package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var errAlreadyMember = apperr.New(apperr.Conflict, "already_member", "Bu raqam kompaniyangizga allaqachon qo'shilgan")

// Members lists the company's members under the names they go by there: the
// owner first, then the users in the order they joined.
func (s *Service) Members(ctx context.Context, companyID int64) ([]Member, error) {
	rows, err := s.q.ListCompanyUsers(ctx, companyID)
	if err != nil {
		return nil, err
	}
	members := make([]Member, 0, len(rows))
	for _, u := range rows {
		members = append(members, Member{Phone: u.Phone, FullName: u.FullName, Role: u.Role, CreatedAt: u.CreatedAt})
	}
	return members, nil
}

// AddEmployee adds the user with phone to the company as a user under
// fullName, in one transaction. A phone that is no user yet becomes one; a
// user of other companies gets one more, and stays as they are in the others.
func (s *Service) AddEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error) {
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
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
			return err
		}
		uc, err := q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: normalized, CompanyID: companyID, Role: "user", FullName: &name})
		if errors.Is(err, pgx.ErrNoRows) {
			// A member already, the owner too: nothing changes, so the
			// owner is never made a user from the app.
			return errAlreadyMember
		}
		if err != nil {
			return err
		}
		m = Member{Phone: uc.UserPhone, FullName: uc.FullName, Role: uc.Role, CreatedAt: uc.CreatedAt}
		return nil
	})
	return m, err
}
