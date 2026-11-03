// Package dashboard is what the home shows at a glance
// (docs/superpowers/specs/2026-11-03-flat-redesign-design.md): what the
// accounts hold, what the customers owe, the orders not done, the month's
// sales and the products running low, each block to whoever may see it.
package dashboard

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
	"github.com/SalikhovID/hisob24/backend/internal/order"
)

// Service reads the dashboard.
type Service struct {
	q      *gen.Queries
	orders *order.Service
}

// NewService is the dashboard over the database; the orders service gives
// the upcoming orders as the lists have them.
func NewService(pool *pgxpool.Pool, orders *order.Service) *Service {
	return &Service{q: gen.New(pool), orders: orders}
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
	Cash     *Cash
	Debtors  *Debtors
	Orders   *Orders
	Sales    *Money
	LowStock *LowStock
}

// Cash is what the company's live accounts hold (the turned off ones too),
// summed by currency and not turned into another (logic/finance.md,
// section 4): a currency that comes to 0 is left out; and how many live
// accounts there are.
type Cash struct {
	Totals   []CurrencyAmount
	Accounts int64
}

// CurrencyAmount is a sum in one currency, two decimals.
type CurrencyAmount struct {
	CurrencyID int64
	Amount     string
}

// Debtors is what the company's customers owe (logic/sales.md, section 5):
// their so'm balances above zero summed, and how many they are.
type Debtors struct {
	Debt  string
	Count int64
}

// LowStock is the products running low in the location, or in every one
// of the scope summed (logic/warehouse.md, section 5): how many they are,
// and the names of the first of them by name.
type LowStock struct {
	Count int64
	Names []string
}

// Orders is the orders of the location (or of every one of the scope) not
// done yet: how many, how many of them are past their deadline, how many
// stand in each stage not done (in the stages' order, the empty ones too)
// and the five due soonest.
type Orders struct {
	Active   int64
	Late     int64
	ByStage  []StageCount
	Upcoming []order.Order
}

// Money is the sales of the location (or of every one of the scope) this
// month up to today: their total in so'm, each by its own rate row, how
// many, and the total by the end of each day of the month (the member's
// days).
type Money struct {
	MonthTotal string
	MonthCount int64
	ByDay      []string
}

// StageCount is how many orders stand in a stage.
type StageCount struct {
	StageID int64
	Count   int64
}

// Get is the dashboard of the member within the scope.
func (s *Service) Get(ctx context.Context, scope Scope, in Input) (Dashboard, error) {
	var d Dashboard
	if in.Permissions.Has(access.FinanceView) {
		cash, err := s.cash(ctx, scope.CompanyID)
		if err != nil {
			return Dashboard{}, err
		}
		d.Cash = cash
	}
	if in.Permissions.Has(access.CustomersView) && in.Permissions.Has(access.SalesView) {
		row, err := s.q.DashboardDebtors(ctx, scope.CompanyID)
		if err != nil {
			return Dashboard{}, err
		}
		d.Debtors = &Debtors{Debt: amount(row.Debt), Count: row.Debtors}
	}
	if in.Permissions.Has(access.StockView) {
		rows, err := s.q.DashboardLowStock(ctx, gen.DashboardLowStockParams{
			CompanyID: scope.CompanyID, LocationIds: scope.locations(in.LocationID), AtMost: lowStockAtMost, Limit: lowStockNames,
		})
		if err != nil {
			return Dashboard{}, err
		}
		low := &LowStock{Names: make([]string, 0, len(rows))}
		for _, row := range rows {
			low.Names = append(low.Names, row.Name)
			low.Count = row.Total
		}
		d.LowStock = low
	}
	if in.Permissions.Has(access.OrdersView) {
		locations := scope.locations(in.LocationID)
		counts, err := s.q.DashboardOrders(ctx, gen.DashboardOrdersParams{CompanyID: scope.CompanyID, LocationIds: locations, Today: in.Today})
		if err != nil {
			return Dashboard{}, err
		}
		rows, err := s.q.DashboardOrdersByStage(ctx, gen.DashboardOrdersByStageParams{CompanyID: scope.CompanyID, LocationIds: locations})
		if err != nil {
			return Dashboard{}, err
		}
		upcoming, err := s.orders.Upcoming(ctx, order.Scope{CompanyID: scope.CompanyID, LocationIDs: scope.LocationIDs}, in.LocationID, upcomingCount)
		if err != nil {
			return Dashboard{}, err
		}
		orders := &Orders{Active: counts.Active, Late: counts.Late, ByStage: make([]StageCount, 0, len(rows)), Upcoming: upcoming}
		for _, row := range rows {
			orders.ByStage = append(orders.ByStage, StageCount{StageID: row.StageID, Count: row.Count})
		}
		d.Orders = orders
	}
	if in.Permissions.Has(access.SalesView) {
		rows, err := s.q.DashboardMoneyByDay(ctx, gen.DashboardMoneyByDayParams{
			CompanyID: scope.CompanyID, Kind: "sale", LocationIds: scope.locations(in.LocationID), Zone: in.Zone, MonthStart: monthStart(in.Today), Today: in.Today,
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
		d.Sales = m
	}
	return d, nil
}

// cash is what the company's accounts hold, by currency, and how many
// there are.
func (s *Service) cash(ctx context.Context, companyID int64) (*Cash, error) {
	rows, err := s.q.DashboardCash(ctx, companyID)
	if err != nil {
		return nil, err
	}
	accounts, err := s.q.DashboardAccounts(ctx, companyID)
	if err != nil {
		return nil, err
	}
	c := &Cash{Totals: make([]CurrencyAmount, 0, len(rows)), Accounts: accounts}
	for _, row := range rows {
		c.Totals = append(c.Totals, CurrencyAmount{CurrencyID: row.CurrencyID, Amount: amount(row.Amount)})
	}
	return c, nil
}

// lowStockAtMost is the stock a product runs low at, and lowStockNames how
// many of their names the home shows (logic/warehouse.md, section 5).
const (
	lowStockAtMost = 3
	lowStockNames  = 5
)

// upcomingCount is how many of the orders due soonest the home shows.
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
