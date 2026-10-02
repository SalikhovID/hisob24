package company

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
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
	rows, err := s.q.ListCompanyUsers(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	today, err := s.q.CurrentDate(ctx)
	if err != nil {
		return Detail{}, err
	}
	users := make([]Member, 0, len(rows))
	for _, u := range rows {
		users = append(users, Member{Phone: u.Phone, FullName: u.FullName, Role: u.Role, CreatedAt: u.CreatedAt})
	}
	return Detail{Company: withDaysLeft(c, today), Users: users}, nil
}
