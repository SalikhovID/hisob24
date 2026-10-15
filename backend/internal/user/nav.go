package user

import "github.com/SalikhovID/hisob24/backend/internal/apperr"

// NavSections are the app's sections by key, in the default order of the
// menu (logic/roles.md, section 8): a member may put them in their own
// order, which their membership keeps.
var NavSections = []string{"home", "customers", "tasks", "products", "sales", "warehouse", "finance", "employees", "settings"}

// ParseNavOrder reads an order of the sections as a client sends it: each
// key one of NavSections, a repeated one counts once. Nothing is an order
// too (the client fills the rest in the default order).
func ParseNavOrder(raw []string) ([]string, error) {
	known := make(map[string]bool, len(NavSections))
	for _, s := range NavSections {
		known[s] = true
	}
	order := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, key := range raw {
		if !known[key] {
			return nil, apperr.New(apperr.Invalid, "validation_error", "Bo'lim noto'g'ri")
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		order = append(order, key)
	}
	return order, nil
}

// TabBarPages are the pages a member may put in the tab bar, by key, in
// the order of the menu (logic/roles.md, section 8): the sections' own
// pages, the tabs, the warehouse and its pages. The settings are none of
// them: they stand under «Sozlama».
var TabBarPages = []string{
	"home", "customers", "tasks", "products", "services", "sales",
	"warehouse", "purchases", "transfers", "inventories", "opening_stock", "suppliers",
	"accounts", "expenses", "money_transfers", "employees",
}

// TabBarLimit is how many pages the tab bar holds beside «Sozlama».
const TabBarLimit = 4

// ParseTabBar reads the pages of the tab bar as a client sends them, in
// their order: each key one of TabBarPages, a repeated one counts once, and
// TabBarLimit at most. Nothing is a bar too.
func ParseTabBar(raw []string) ([]string, error) {
	known := make(map[string]bool, len(TabBarPages))
	for _, page := range TabBarPages {
		known[page] = true
	}
	pages := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, key := range raw {
		if !known[key] {
			return nil, apperr.New(apperr.Invalid, "validation_error", "Sahifa noto'g'ri")
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		pages = append(pages, key)
	}
	if len(pages) > TabBarLimit {
		return nil, apperr.New(apperr.Invalid, "validation_error", "Panelda ko'pi bilan 4 ta sahifa")
	}
	return pages, nil
}
