package customer

import (
	"context"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

var errDropdownNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli dropdown allaqachon bor")

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

// CreateDropdown adds an empty dropdown to the company. Its name is the
// company's only one of the kind, whatever the case.
func (s *Service) CreateDropdown(ctx context.Context, companyID int64, name string) (Dropdown, error) {
	name, err := cleanName(name)
	if err != nil {
		return Dropdown{}, err
	}
	d, err := s.q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: companyID, Name: name})
	if taken(err) {
		return Dropdown{}, errDropdownNameTaken
	}
	if err != nil {
		return Dropdown{}, err
	}
	return Dropdown{ID: d.ID, Name: d.Name, Options: []Option{}}, nil
}
