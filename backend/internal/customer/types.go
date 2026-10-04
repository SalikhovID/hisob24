package customer

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

var (
	errTypeNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor")
	errTypeNotFound  = apperr.New(apperr.NotFound, "not_found", "Tur topilmadi")
)

// Field is one question of a customer type. The choice kinds take their
// options from a dropdown.
type Field struct {
	ID         int64
	Label      string
	Kind       string
	Required   bool
	Unique     bool
	DropdownID *int64
}

// Type is a kind of customer (Jismoniy, Yuridik) with the fields its form
// asks, in their order.
type Type struct {
	ID     int64
	Name   string
	Fields []Field
}

// CreateType adds a type with no fields at the end of the company's types.
func (s *Service) CreateType(ctx context.Context, companyID int64, name string) (Type, error) {
	name, err := cleanName(name)
	if err != nil {
		return Type{}, err
	}
	var ct gen.CustomerType
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		ct, err = q.CreateCustomerType(ctx, gen.CreateCustomerTypeParams{CompanyID: companyID, Name: name})
		if taken(err) {
			return errTypeNameTaken
		}
		return err
	})
	if err != nil {
		return Type{}, err
	}
	return Type{ID: ct.ID, Name: ct.Name, Fields: []Field{}}, nil
}

// Types lists the company's types in their order, each with its fields in
// theirs.
func (s *Service) Types(ctx context.Context, companyID int64) ([]Type, error) {
	rows, err := s.q.ListCustomerTypes(ctx, companyID)
	if err != nil {
		return nil, err
	}
	fields, err := s.q.ListCustomerFields(ctx, companyID)
	if err != nil {
		return nil, err
	}
	of := map[int64][]Field{}
	for _, f := range fields {
		of[f.TypeID] = append(of[f.TypeID], toField(f))
	}
	list := make([]Type, 0, len(rows))
	for _, ct := range rows {
		t := Type{ID: ct.ID, Name: ct.Name, Fields: of[ct.ID]}
		if t.Fields == nil {
			t.Fields = []Field{}
		}
		list = append(list, t)
	}
	return list, nil
}

func toField(f gen.CustomerField) Field {
	return Field{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, Unique: f.IsUnique, DropdownID: f.DropdownID}
}

// RenameType gives the company's type another name.
func (s *Service) RenameType(ctx context.Context, companyID, id int64, name string) (Type, error) {
	name, err := cleanName(name)
	if err != nil {
		return Type{}, err
	}
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: id, CompanyID: companyID, Name: name})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errTypeNotFound
		case taken(err):
			return errTypeNameTaken
		}
		return err
	})
	if err != nil {
		return Type{}, err
	}
	return s.customerType(ctx, companyID, id)
}

// customerType is the company's type with its fields.
func (s *Service) customerType(ctx context.Context, companyID, id int64) (Type, error) {
	list, err := s.Types(ctx, companyID)
	if err != nil {
		return Type{}, err
	}
	for _, t := range list {
		if t.ID == id {
			return t, nil
		}
	}
	return Type{}, errTypeNotFound
}

// OrderTypes puts the company's types in the order of ids, which has to
// name each of them once and nothing else.
func (s *Service) OrderTypes(ctx context.Context, companyID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		rows, err := q.ListCustomerTypes(ctx, companyID)
		if err != nil {
			return err
		}
		live := make([]int64, 0, len(rows))
		for _, ct := range rows {
			live = append(live, ct.ID)
		}
		if !sameIDs(ids, live) {
			return errOrderChanged
		}
		return q.OrderCustomerTypes(ctx, gen.OrderCustomerTypesParams{CompanyID: companyID, Ids: ids})
	})
}

// DeleteType hides the company's type and its fields with it; the type's
// name is free again.
func (s *Service) DeleteType(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteCustomerType(ctx, gen.DeleteCustomerTypeParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTypeNotFound
		}
		if err != nil {
			return err
		}
		return q.DeleteCustomerTypeFields(ctx, id)
	})
}
