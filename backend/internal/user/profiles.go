package user

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Membership is one of a user's companies and the role there.
type Membership struct {
	CompanyID int64
	Name      string
	Role      string
	EndDate   time.Time
	IsActive  bool
}

// Profile is a user and their companies.
type Profile struct {
	Phone     string
	FullName  *string
	Companies []Membership
}

// Profiles reads what the user app shows about its user.
type Profiles struct {
	q *gen.Queries
}

// NewProfiles wires the profiles reader.
func NewProfiles(pool *pgxpool.Pool) *Profiles {
	return &Profiles{q: gen.New(pool)}
}

// Get is the user with phone and their companies, by name.
func (p *Profiles) Get(ctx context.Context, phone string) (Profile, error) {
	u, err := p.q.GetUser(ctx, phone)
	if err != nil {
		return Profile{}, err
	}
	rows, err := p.q.ListUserCompanies(ctx, phone)
	if err != nil {
		return Profile{}, err
	}
	companies := make([]Membership, 0, len(rows))
	for _, c := range rows {
		companies = append(companies, Membership{CompanyID: c.ID, Name: c.Name, Role: c.Role, EndDate: c.EndDate, IsActive: c.IsActive})
	}
	return Profile{Phone: u.Phone, FullName: u.FullName, Companies: companies}, nil
}
