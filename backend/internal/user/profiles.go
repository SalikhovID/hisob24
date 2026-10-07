package user

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Membership is one of a user's companies, with the role, the company role
// they hold there (nil for the owner and for a user without one) and the
// name the user goes by there. DaysLeft counts from the database's today;
// below zero the subscription is over.
type Membership struct {
	CompanyID int64
	Name      string
	Role      string
	RoleName  *string
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
			CompanyID: c.ID, Name: c.Name, Role: c.Role, RoleName: c.RoleName, FullName: c.FullName,
			EndDate: c.EndDate, DaysLeft: int(c.DaysLeft), IsActive: c.IsActive,
		})
	}
	return Profile{Phone: u.Phone, FullName: u.FullName, Companies: companies}, nil
}

// Access is a user's standing in a company right now: the role there, what
// they may do (logic/roles.md, section 4), the locations they may work in
// (logic/locations.md, section 5) and whether the company's subscription
// lets it be used (its end date has not passed and it is not blocked).
type Access struct {
	Role        string
	Permissions access.Set
	// LocationIDs is the live locations the user may work in, in the order
	// they were added: every one of the company's unless restricted to
	// some. Empty, never nil.
	LocationIDs []int64
	Active      bool
}

// ErrNotMember: the user is not a member of the company, or no longer.
var ErrNotMember = errors.New("not a member of the company")

// Access reads a user's standing in a company afresh, so a membership taken
// away, a role given, a role's permissions changed or a restriction to some
// locations count from the next request on. The owner may do everything, a
// user with no role what the default allows, a user with a role what the
// role holds.
func (p *Profiles) Access(ctx context.Context, phone string, companyID int64) (Access, error) {
	row, err := p.q.GetCompanyAccess(ctx, gen.GetCompanyAccessParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Access{}, ErrNotMember
	}
	if err != nil {
		return Access{}, err
	}
	locations := row.LocationIds
	if locations == nil {
		locations = []int64{}
	}
	return Access{Role: row.Role, Permissions: access.Effective(row.Role, row.RoleID != nil, row.Permissions), LocationIDs: locations, Active: row.Active}, nil
}
