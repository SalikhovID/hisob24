package customer

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

var (
	errDropdownNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli dropdown allaqachon bor")
	errDropdownNotFound  = apperr.New(apperr.NotFound, "not_found", "Dropdown topilmadi")
	errOptionTaken       = apperr.New(apperr.Conflict, "name_taken", "Bu variant allaqachon bor")
	errOptionNotFound    = apperr.New(apperr.NotFound, "not_found", "Variant topilmadi")
)

// Dropdown is a list of options the choice fields take theirs from.
type Dropdown struct {
	ID      int64
	Name    string
	Options []Option
}

// CreateDropdown adds an empty dropdown to the company. Its name is the
// company's only one of the kind, whatever the case.
func (s *Service) CreateDropdown(ctx context.Context, companyID int64, name string) (Dropdown, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Dropdown{}, err
	}
	var d gen.CustomerDropdown
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		d, err = q.CreateCustomerDropdown(ctx, gen.CreateCustomerDropdownParams{CompanyID: companyID, Name: name})
		if fields.Taken(err) {
			return errDropdownNameTaken
		}
		return err
	})
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
		of[o.DropdownID] = append(of[o.DropdownID], toOption(o))
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
	name, err := fields.CleanName(name)
	if err != nil {
		return Dropdown{}, err
	}
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.RenameCustomerDropdown(ctx, gen.RenameCustomerDropdownParams{ID: id, CompanyID: companyID, Name: name})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errDropdownNotFound
		case fields.Taken(err):
			return errDropdownNameTaken
		}
		return err
	})
	if err != nil {
		return Dropdown{}, err
	}
	return s.dropdown(ctx, companyID, id)
}

// dropdown is the company's dropdown with its options.
func (s *Service) dropdown(ctx context.Context, companyID, id int64) (Dropdown, error) {
	list, err := s.Dropdowns(ctx, companyID)
	if err != nil {
		return Dropdown{}, err
	}
	for _, d := range list {
		if d.ID == id {
			return d, nil
		}
	}
	return Dropdown{}, errDropdownNotFound
}

// AddOption adds an option at the end of the company's dropdown.
func (s *Service) AddOption(ctx context.Context, companyID, dropdownID int64, label string) (Option, error) {
	label, err := fields.CleanName(label)
	if err != nil {
		return Option{}, err
	}
	var o gen.CustomerDropdownOption
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		o, err = q.AddCustomerDropdownOption(ctx, gen.AddCustomerDropdownOptionParams{
			CompanyID: companyID, DropdownID: dropdownID, Label: label,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errDropdownNotFound
		case fields.Taken(err):
			return errOptionTaken
		}
		return err
	})
	if err != nil {
		return Option{}, err
	}
	return toOption(o), nil
}

func toOption(o gen.CustomerDropdownOption) Option {
	return Option{ID: o.ID, Label: o.Label, Active: o.IsActive}
}

// OptionPatch is what to change in an option; nil leaves a part as it is.
type OptionPatch struct {
	Label  *string
	Active *bool
}

// UpdateOption renames an option of the company's dropdown, or turns it off
// or on.
func (s *Service) UpdateOption(ctx context.Context, companyID, dropdownID, optionID int64, patch OptionPatch) (Option, error) {
	if patch.Label != nil {
		label, err := fields.CleanName(*patch.Label)
		if err != nil {
			return Option{}, err
		}
		patch.Label = &label
	}
	var o gen.CustomerDropdownOption
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		var err error
		o, err = q.UpdateCustomerDropdownOption(ctx, gen.UpdateCustomerDropdownOptionParams{
			CompanyID: companyID, DropdownID: dropdownID, ID: optionID, Label: patch.Label, IsActive: patch.Active,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errOptionNotFound
		case fields.Taken(err):
			return errOptionTaken
		}
		return err
	})
	if err != nil {
		return Option{}, err
	}
	return toOption(o), nil
}

// DeleteOption hides an option of the company's dropdown; its name is free
// again. An option that customers have chosen is not deleted: it can be
// turned off instead.
func (s *Service) DeleteOption(ctx context.Context, companyID, dropdownID, optionID int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteCustomerDropdownOption(ctx, gen.DeleteCustomerDropdownOptionParams{
			CompanyID: companyID, DropdownID: dropdownID, ID: optionID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return errOptionNotFound
		}
		if err != nil {
			return err
		}
		// The option is the company's own, so its count may be told. The
		// refusal undoes the delete: the write is one transaction.
		used, err := q.CountOptionCustomers(ctx, &optionID)
		if err != nil {
			return err
		}
		if used > 0 {
			return apperr.New(apperr.Conflict, "option_in_use", fmt.Sprintf("Bu variant %d ta mijozda tanlangan", used))
		}
		return nil
	})
}

// OrderOptions puts the options of the company's dropdown in the order of
// ids, which has to name each of them once and nothing else.
func (s *Service) OrderOptions(ctx context.Context, companyID, dropdownID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: dropdownID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errDropdownNotFound
		}
		if err != nil {
			return err
		}
		live, err := q.ListCustomerDropdownOptionIDs(ctx, dropdownID)
		if err != nil {
			return err
		}
		if !fields.SameIDs(ids, live) {
			return fields.ErrOrderChanged
		}
		return q.OrderCustomerDropdownOptions(ctx, gen.OrderCustomerDropdownOptionsParams{DropdownID: dropdownID, Ids: ids})
	})
}

// DeleteDropdown hides the company's dropdown; its name is free again. A
// dropdown that a field takes its options from is not deleted.
func (s *Service) DeleteDropdown(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errDropdownNotFound
		}
		if err != nil {
			return err
		}
		used, err := q.CountCustomerDropdownFields(ctx, &id)
		if err != nil {
			return err
		}
		if used > 0 {
			return apperr.New(apperr.Conflict, "dropdown_in_use", fmt.Sprintf("Bu dropdown %d ta maydonda ishlatilgan", used))
		}
		_, err = q.DeleteCustomerDropdown(ctx, gen.DeleteCustomerDropdownParams{ID: id, CompanyID: companyID})
		return err
	})
}
