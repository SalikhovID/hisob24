package app

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/dashboard"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// dashboardJSON is the home's blocks; one the member may not see is null.
type dashboardJSON struct {
	Cash     *dashboardCashJSON     `json:"cash"`
	Debtors  *dashboardDebtorsJSON  `json:"debtors"`
	Orders   *dashboardOrdersJSON   `json:"orders"`
	Sales    *dashboardMoneyJSON    `json:"sales"`
	LowStock *dashboardLowStockJSON `json:"low_stock"`
}

type dashboardCashJSON struct {
	Totals   []currencyAmountJSON `json:"totals"`
	Accounts int64                `json:"accounts"`
}

type currencyAmountJSON struct {
	CurrencyID int64  `json:"currency_id"`
	Amount     string `json:"amount"`
}

type dashboardDebtorsJSON struct {
	Debt  string `json:"debt"`
	Count int64  `json:"count"`
}

type dashboardLowStockJSON struct {
	Count int64    `json:"count"`
	Names []string `json:"names"`
}

type dashboardOrdersJSON struct {
	Active   int64                `json:"active"`
	Late     int64                `json:"late"`
	ByStage  []dashboardStageJSON `json:"by_stage"`
	Upcoming []orderJSON          `json:"upcoming"`
}

type dashboardStageJSON struct {
	StageID int64 `json:"stage_id"`
	Count   int64 `json:"count"`
}

type dashboardMoneyJSON struct {
	MonthTotal string   `json:"month_total"`
	MonthCount int64    `json:"month_count"`
	ByDay      []string `json:"by_day"`
}

// getDashboard is the home's blocks at a glance, each to whoever may see
// it: of the location asked for (?location_id=, one of the member's: 403
// otherwise, as the lists answer; «Lokatsiya noto'g'ri» when it is no
// number) or of every one of the member's, the days counted in their zone.
func (h *Handler) getDashboard(w http.ResponseWriter, r *http.Request) {
	var locationID int64
	if raw := r.URL.Query().Get("location_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			httpx.Error(w, http.StatusBadRequest, "validation_error", "Lokatsiya noto'g'ri")
			return
		}
		if !allowedLocation(r, id) {
			forbidden(w)
			return
		}
		locationID = id
	}
	zone := memberZone(r)
	loc, err := time.LoadLocation(zone)
	if err != nil {
		zone = "Asia/Tashkent"
		if loc, err = time.LoadLocation(zone); err != nil {
			loc = time.FixedZone(zone, 5*60*60)
		}
	}
	now := time.Now().In(loc)
	d, err := h.dashboard.Get(r.Context(),
		dashboard.Scope{CompanyID: sessionCompany(r), LocationIDs: currentAccess(r.Context()).LocationIDs},
		dashboard.Input{
			Permissions: currentPermissions(r.Context()), LocationID: locationID, Zone: zone,
			Today: time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC),
		})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toDashboardJSON(d))
}

func toDashboardJSON(d dashboard.Dashboard) dashboardJSON {
	var out dashboardJSON
	if c := d.Cash; c != nil {
		cash := &dashboardCashJSON{Totals: make([]currencyAmountJSON, 0, len(c.Totals)), Accounts: c.Accounts}
		for _, total := range c.Totals {
			cash.Totals = append(cash.Totals, currencyAmountJSON{CurrencyID: total.CurrencyID, Amount: total.Amount})
		}
		out.Cash = cash
	}
	if debtors := d.Debtors; debtors != nil {
		out.Debtors = &dashboardDebtorsJSON{Debt: debtors.Debt, Count: debtors.Count}
	}
	if low := d.LowStock; low != nil {
		out.LowStock = &dashboardLowStockJSON{Count: low.Count, Names: low.Names}
	}
	if t := d.Orders; t != nil {
		orders := &dashboardOrdersJSON{Active: t.Active, Late: t.Late, ByStage: make([]dashboardStageJSON, 0, len(t.ByStage)), Upcoming: make([]orderJSON, 0, len(t.Upcoming))}
		for _, s := range t.ByStage {
			orders.ByStage = append(orders.ByStage, dashboardStageJSON{StageID: s.StageID, Count: s.Count})
		}
		for _, order := range t.Upcoming {
			orders.Upcoming = append(orders.Upcoming, toOrderJSON(order))
		}
		out.Orders = orders
	}
	if m := d.Sales; m != nil {
		out.Sales = &dashboardMoneyJSON{MonthTotal: m.MonthTotal, MonthCount: m.MonthCount, ByDay: m.ByDay}
	}
	return out
}
