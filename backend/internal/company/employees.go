package company

import (
	"context"
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
