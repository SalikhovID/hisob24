// Package dashboard is what the home shows at a glance
// (docs/superpowers/specs/2026-10-13-mini-app-ui-design.md): what is owed
// to the suppliers, the customers, the orders, the month's purchases and
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
	Cash      *Cash
	Debtors   *Debtors
	LowStock  *LowStock
	Suppliers *Suppliers
	Customers *Customers
	Orders    *Orders
	Purchases *Money
	Sales     *Money
	// OrdersMoney is the month's priced orders (their documents), for
	// whoever sees the orders (logic/orders.md, 4.3).
	OrdersMoney *Money
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

// Money is a kind of documents (the purchases, the sales, the priced orders) of the
// location (or of every one of the scope) this month up to today: their
// total in so'm, each by its own rate row, how many, and the total by the
// end of each day of the month (the member's days).
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
	for _, block := range []struct {
		permission access.Permission
		kind       string
		into       **Money
	}{{access.PurchasesView, "purchase", &d.Purchases}, {access.SalesView, "sale", &d.Sales}, {access.OrdersView, "order", &d.OrdersMoney}} {
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
