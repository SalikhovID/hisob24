package company

import (
	"context"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

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
// fullName. A phone that is no user yet becomes one; a user of other
// companies gets one more, and stays as they are in the others.
func (s *Service) AddEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error) {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, err
	}
	name := strings.TrimSpace(fullName)
	if err := s.q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
		return Member{}, err
	}
	uc, err := s.q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: normalized, CompanyID: companyID, Role: "user", FullName: &name})
	if err != nil {
		return Member{}, err
	}
	return Member{Phone: uc.UserPhone, FullName: uc.FullName, Role: uc.Role, CreatedAt: uc.CreatedAt}, nil
}
