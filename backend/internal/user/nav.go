package user

import "github.com/SalikhovID/hisob24/backend/internal/apperr"

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
