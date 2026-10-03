package user

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Membership is one of a user's companies, with the role and the name the
// user goes by there. DaysLeft counts from the database's today; below zero
// the subscription is over.
type Membership struct {
	CompanyID int64
	Name      string
	Role      string
	FullName  *string
	EndDate   time.Time
	DaysLeft  int
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
		companies = append(companies, Membership{
			CompanyID: c.ID, Name: c.Name, Role: c.Role, FullName: c.FullName,
			EndDate: c.EndDate, DaysLeft: int(c.DaysLeft), IsActive: c.IsActive,
		})
	}
	return Profile{Phone: u.Phone, FullName: u.FullName, Companies: companies}, nil
}

// Access is a user's standing in a company right now: the role there and
// whether the company's subscription lets it be used (its end date has not
// passed and it is not blocked).
type Access struct {
	Role   string
	Active bool
}

// ErrNotMember: the user is not a member of the company, or no longer.
var ErrNotMember = errors.New("not a member of the company")

// Access reads a user's standing in a company afresh, so a membership taken
// away or a role changed counts from the next request on.
func (p *Profiles) Access(ctx context.Context, phone string, companyID int64) (Access, error) {
	row, err := p.q.GetCompanyAccess(ctx, gen.GetCompanyAccessParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Access{}, ErrNotMember
	}
	if err != nil {
		return Access{}, err
	}
	return Access{Role: row.Role, Active: row.Active}, nil
}

// SubscriptionActive says whether a company may be used: its end date has
// not passed and it is not blocked. A missing company may not.
func (p *Profiles) SubscriptionActive(ctx context.Context, companyID int64) (bool, error) {
	active, err := p.q.IsCompanySubscriptionActive(ctx, companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return active, err
}
