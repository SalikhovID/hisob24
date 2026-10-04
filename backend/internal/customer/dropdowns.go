package customer

import (
	"context"
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Option is one choice of a dropdown. An option that is not active is no
// longer offered, but stays on the customers who chose it.
type Option struct {
	ID     int64
	Label  string
	Active bool
}

// Dropdown is a list of options the choice fields take theirs from.
type Dropdown struct {
	ID      int64
	Name    string
	Options []Option
}

// CreateDropdown adds an empty dropdown to the company.
func (s *Service) CreateDropdown(ctx context.Context, companyID int64, name string) (Dropdown, error) {
	d, err := s.q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: companyID, Name: strings.TrimSpace(name)})
	if err != nil {
		return Dropdown{}, err
	}
	return Dropdown{ID: d.ID, Name: d.Name, Options: []Option{}}, nil
}
