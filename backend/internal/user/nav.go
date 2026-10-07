package user

import "github.com/SalikhovID/hisob24/backend/internal/apperr"

// NavSections are the app's sections by key, in the default order of the
// menu (logic/roles.md, section 8): a member may put them in their own
// order, which their membership keeps.
var NavSections = []string{"home", "customers", "tasks", "products", "warehouse", "employees", "settings"}

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
