// Package dashboard is what the home shows at a glance
// (docs/superpowers/specs/2026-10-13-mini-app-ui-design.md): what is owed
// to the suppliers, the customers, the tasks, the month's purchases and
// sales, each block to whoever may see it.
package dashboard

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/task"
)

// Service reads the dashboard.
type Service struct {
	q     *gen.Queries
	tasks *task.Service
}

// NewService is the dashboard over the database; the tasks service gives
// the upcoming tasks as the lists have them.
func NewService(pool *pgxpool.Pool, tasks *task.Service) *Service {
	return &Service{q: gen.New(pool), tasks: tasks}
}

// Scope is the member's reach: the company and the locations of it they
// may work in.
type Scope struct {
	CompanyID   int64
	LocationIDs []int64
}

// Input is what the dashboard is asked for: what the member may see, the
// location (0: every one of the scope), the zone the member's days are
// counted in and their today in it.
type Input struct {
	Permissions access.Set
	LocationID  int64
	Zone        string
	Today       time.Time
}

// Dashboard is the home's blocks; one the member may not see is nil.
type Dashboard struct {
	Suppliers *Suppliers
}

// Suppliers is what the company's suppliers are owed, in so'm, each
// document by its own rate row (logic/currencies.md): the balances above
// zero summed, how many they are, and those below zero (the advances)
// summed as a positive amount.
type Suppliers struct {
	Debt    string
	Debtors int64
	Advance string
}

// Get is the dashboard of the member within the scope.
func (s *Service) Get(ctx context.Context, scope Scope, in Input) (Dashboard, error) {
	var d Dashboard
	if in.Permissions.Has(access.PurchasesView) {
		row, err := s.q.DashboardSuppliers(ctx, scope.CompanyID)
		if err != nil {
			return Dashboard{}, err
		}
		d.Suppliers = &Suppliers{Debt: amount(row.Debt), Debtors: row.Debtors, Advance: amount(row.Advance)}
	}
	return d, nil
}

// amount is a sum of money as the API shows it: two decimals.
func amount(n pgtype.Numeric) string {
	if s := numtext.Amount(n); s != nil {
		return *s
	}
	return "0.00"
}
