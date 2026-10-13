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
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
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
	Customers *Customers
	Tasks     *Tasks
	Purchases *Money
	Sales     *Money
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

// Customers is the company's live customers: how many there are by the
// end of today, how many of them came this month, and how many there were
// by the end of each day of the month up to today (the member's days).
type Customers struct {
	Total          int64
	AddedThisMonth int64
	ByDay          []int64
}

// Tasks is the tasks of the location (or of every one of the scope) not
// done yet: how many, how many of them are past their deadline, how many
// stand in each stage not done (in the stages' order, the empty ones too)
// and the five due soonest.
type Tasks struct {
	Active   int64
	Late     int64
	ByStage  []StageCount
	Upcoming []task.Task
}

// Money is a kind of goods documents (the purchases, the sales) of the
// location (or of every one of the scope) this month up to today: their
// total in so'm, each by its own rate row, how many, and the total by the
// end of each day of the month (the member's days).
type Money struct {
	MonthTotal string
	MonthCount int64
	ByDay      []string
}

// StageCount is how many tasks stand in a stage.
type StageCount struct {
	StageID int64
	Count   int64
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
	if in.Permissions.Has(access.CustomersView) {
		rows, err := s.q.DashboardCustomersByDay(ctx, gen.DashboardCustomersByDayParams{
			CompanyID: scope.CompanyID, Zone: in.Zone, MonthStart: monthStart(in.Today), Today: in.Today,
		})
		if err != nil {
			return Dashboard{}, err
		}
		c := &Customers{ByDay: make([]int64, 0, len(rows))}
		for _, row := range rows {
			c.ByDay = append(c.ByDay, row.Total)
			c.Total = row.Total
			c.AddedThisMonth = row.Total - row.Before
		}
		d.Customers = c
	}
	if in.Permissions.Has(access.TasksView) {
		locations := scope.locations(in.LocationID)
		counts, err := s.q.DashboardTasks(ctx, gen.DashboardTasksParams{CompanyID: scope.CompanyID, LocationIds: locations, Today: in.Today})
		if err != nil {
			return Dashboard{}, err
		}
		rows, err := s.q.DashboardTasksByStage(ctx, gen.DashboardTasksByStageParams{CompanyID: scope.CompanyID, LocationIds: locations})
		if err != nil {
			return Dashboard{}, err
		}
		upcoming, err := s.tasks.Upcoming(ctx, task.Scope{CompanyID: scope.CompanyID, LocationIDs: scope.LocationIDs}, in.LocationID, upcomingCount)
		if err != nil {
			return Dashboard{}, err
		}
		tasks := &Tasks{Active: counts.Active, Late: counts.Late, ByStage: make([]StageCount, 0, len(rows)), Upcoming: upcoming}
		for _, row := range rows {
			tasks.ByStage = append(tasks.ByStage, StageCount{StageID: row.StageID, Count: row.Count})
		}
		d.Tasks = tasks
	}
	for _, block := range []struct {
		permission access.Permission
		kind       string
		into       **Money
	}{{access.PurchasesView, "purchase", &d.Purchases}, {access.SalesView, "sale", &d.Sales}} {
		if !in.Permissions.Has(block.permission) {
			continue
		}
		rows, err := s.q.DashboardMoneyByDay(ctx, gen.DashboardMoneyByDayParams{
			CompanyID: scope.CompanyID, Kind: block.kind, LocationIds: scope.locations(in.LocationID), Zone: in.Zone, MonthStart: monthStart(in.Today), Today: in.Today,
		})
		if err != nil {
			return Dashboard{}, err
		}
		m := &Money{MonthTotal: "0.00", ByDay: make([]string, 0, len(rows))}
		for _, row := range rows {
			m.ByDay = append(m.ByDay, amount(row.Total))
			m.MonthTotal = amount(row.Total)
			m.MonthCount = row.Count
		}
		*block.into = m
	}
	return d, nil
}

// upcomingCount is how many of the tasks due soonest the home shows.
const upcomingCount = 5

// locations is where the dashboard counts: the location named, when it is
// the scope's (none when it is not), every one of the scope otherwise.
func (sc Scope) locations(id int64) []int64 {
	if id == 0 {
		if sc.LocationIDs == nil {
			return []int64{}
		}
		return sc.LocationIDs
	}
	for _, l := range sc.LocationIDs {
		if l == id {
			return []int64{id}
		}
	}
	return []int64{}
}

// monthStart is the first day of the day's month.
func monthStart(day time.Time) time.Time {
	return time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// amount is a sum of money as the API shows it: two decimals.
func amount(n pgtype.Numeric) string {
	if s := numtext.Amount(n); s != nil {
		return *s
	}
	return "0.00"
}
