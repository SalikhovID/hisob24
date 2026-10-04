package customer

import (
	"context"
	"errors"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

var errNotImplemented = errors.New("not implemented")

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

// Dropdowns lists the company's dropdowns in the order they were made, each
// with its options in their order.
func (s *Service) Dropdowns(ctx context.Context, companyID int64) ([]Dropdown, error) {
	rows, err := s.q.ListCustomerDropdowns(ctx, companyID)
	if err != nil {
		return nil, err
	}
	options, err := s.q.ListCustomerDropdownOptions(ctx, companyID)
	if err != nil {
		return nil, err
	}
	of := map[int64][]Option{}
	for _, o := range options {
		of[o.DropdownID] = append(of[o.DropdownID], Option{ID: o.ID, Label: o.Label, Active: o.IsActive})
	}
	list := make([]Dropdown, 0, len(rows))
	for _, d := range rows {
		dropdown := Dropdown{ID: d.ID, Name: d.Name, Options: of[d.ID]}
		if dropdown.Options == nil {
			dropdown.Options = []Option{}
		}
		list = append(list, dropdown)
	}
	return list, nil
}

// RenameDropdown gives the company's dropdown another name.
func (s *Service) RenameDropdown(ctx context.Context, companyID, id int64, name string) (Dropdown, error) {
	return Dropdown{}, errNotImplemented
}
