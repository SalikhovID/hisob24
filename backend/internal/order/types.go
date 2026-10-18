package order

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
	errTypeNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor")
	errTypeNotFound  = apperr.New(apperr.NotFound, "not_found", "Tur topilmadi")

	errFieldNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli maydon allaqachon bor")
	errFieldNotFound  = apperr.New(apperr.NotFound, "not_found", "Maydon topilmadi")
	errNoKind         = invalid("Maydon turini tanlang")
	errNoDropdown     = invalid("Dropdownni tanlang")
)

// Field is one question of an order type: the shape the customer fields have,
// but an order field is never told not to repeat.
type Field = fields.Field

// Type is a kind of order (Buyurtma, Shikoyat) with the fields its form asks
// beside the title, the deadline, the customer and the assignee.
type Type struct {
	ID     int64
	Name   string
	Fields []Field
}

// CreateType adds a type with no fields at the end of the company's types.
func (s *Service) CreateType(ctx context.Context, companyID int64, name string) (Type, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Type{}, err
	}
	var tt gen.OrderType
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		tt, err = q.CreateOrderType(ctx, gen.CreateOrderTypeParams{CompanyID: companyID, Name: name})
		if fields.Taken(err) {
			return errTypeNameTaken
		}
		return err
	})
	if err != nil {
		return Type{}, err
	}
	return Type{ID: tt.ID, Name: tt.Name, Fields: []Field{}}, nil
}

// Types lists the company's types in their order, each with its fields in
// theirs.
func (s *Service) Types(ctx context.Context, companyID int64) ([]Type, error) {
	rows, err := s.q.ListOrderTypes(ctx, companyID)
	if err != nil {
		return nil, err
	}
	all, err := s.q.ListOrderFields(ctx, companyID)
	if err != nil {
		return nil, err
	}
	of := map[int64][]Field{}
	for _, f := range all {
		of[f.TypeID] = append(of[f.TypeID], toField(f))
	}
	list := make([]Type, 0, len(rows))
	for _, tt := range rows {
		t := Type{ID: tt.ID, Name: tt.Name, Fields: of[tt.ID]}
		if t.Fields == nil {
			t.Fields = []Field{}
		}
		list = append(list, t)
	}
	return list, nil
}

func toField(f gen.OrderField) Field {
	return Field{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, DropdownID: f.DropdownID}
}

// RenameType gives the company's type another name.
func (s *Service) RenameType(ctx context.Context, companyID, id int64, name string) (Type, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Type{}, err
	}
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.RenameOrderType(ctx, gen.RenameOrderTypeParams{ID: id, CompanyID: companyID, Name: name})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errTypeNotFound
		case fields.Taken(err):
			return errTypeNameTaken
		}
		return err
	})
	if err != nil {
		return Type{}, err
	}
	return s.orderType(ctx, companyID, id)
}

// orderType is the company's type with its fields.
func (s *Service) orderType(ctx context.Context, companyID, id int64) (Type, error) {
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

// ReorderTypes puts the company's types in the order of ids, which has to
// name each of them once and nothing else.
func (s *Service) ReorderTypes(ctx context.Context, companyID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		rows, err := q.ListOrderTypes(ctx, companyID)
		if err != nil {
			return err
		}
		live := make([]int64, 0, len(rows))
		for _, tt := range rows {
			live = append(live, tt.ID)
		}
		if !fields.SameIDs(ids, live) {
			return fields.ErrOrderChanged
		}
		return q.ReorderOrderTypes(ctx, gen.ReorderOrderTypesParams{CompanyID: companyID, Ids: ids})
	})
}

// DeleteType hides the company's type and its fields with it; the type's
// name is free again.
func (s *Service) DeleteType(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteOrderType(ctx, gen.DeleteOrderTypeParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTypeNotFound
		}
		if err != nil {
			return err
		}
		// The type is the company's own, so its count may be told. The
		// refusal undoes the delete: the write is one transaction.
		used, err := q.CountTypeOrders(ctx, id)
		if err != nil {
			return err
		}
		if used > 0 {
			return apperr.New(apperr.Conflict, "type_in_use", fmt.Sprintf("Bu turda %d ta vazifa bor", used))
		}
		return q.DeleteOrderTypeFields(ctx, id)
	})
}

// FieldInput is a new field: its name, kind and mark. A choice kind names
// the dropdown it takes its options from.
type FieldInput struct {
	Label      string
	Kind       string
	Required   bool
	DropdownID *int64
}

// AddField adds a field at the end of the company's type. A choice kind
// needs a dropdown of the company's; text and whole numbers take none.
func (s *Service) AddField(ctx context.Context, companyID, typeID int64, in FieldInput) (Field, error) {
	label, err := fields.CleanName(in.Label)
	if err != nil {
		return Field{}, err
	}
	choice, known := fields.KindOf(in.Kind)
	switch {
	case !known:
		return Field{}, errNoKind
	case choice && in.DropdownID == nil:
		return Field{}, errNoDropdown
	case !choice && in.DropdownID != nil:
		return Field{}, invalid("Matn va son maydoniga dropdown ulanmaydi")
	}
	var f gen.OrderField
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		if in.DropdownID != nil {
			// The dropdown has to be the company's own and not deleted.
			_, err := q.GetCustomerDropdown(ctx, gen.GetCustomerDropdownParams{ID: *in.DropdownID, CompanyID: companyID})
			if errors.Is(err, pgx.ErrNoRows) {
				return errNoDropdown
			}
			if err != nil {
				return err
			}
		}
		f, err = q.AddOrderField(ctx, gen.AddOrderFieldParams{
			CompanyID: companyID, TypeID: typeID, Label: label, Kind: in.Kind, DropdownID: in.DropdownID, Required: in.Required,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errTypeNotFound
		case fields.Taken(err):
			return errFieldNameTaken
		}
		return err
	})
	if err != nil {
		return Field{}, err
	}
	return toField(f), nil
}

// FieldPatch is what to change in a field; nil leaves a part as it is. A
// field's kind and dropdown are never changed.
type FieldPatch struct {
	Label    *string
	Required *bool
}

// UpdateField changes the name and the mark of a field of the company's
// type.
func (s *Service) UpdateField(ctx context.Context, companyID, typeID, fieldID int64, patch FieldPatch) (Field, error) {
	if patch.Label != nil {
		label, err := fields.CleanName(*patch.Label)
		if err != nil {
			return Field{}, err
		}
		patch.Label = &label
	}
	var f gen.OrderField
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		var err error
		f, err = q.UpdateOrderField(ctx, gen.UpdateOrderFieldParams{
			ID: fieldID, TypeID: typeID, CompanyID: companyID, Label: patch.Label, Required: patch.Required,
		})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errFieldNotFound
		case fields.Taken(err):
			return errFieldNameTaken
		}
		return err
	})
	if err != nil {
		return Field{}, err
	}
	return toField(f), nil
}

// DeleteField hides a field of the company's type; its name is free again.
func (s *Service) DeleteField(ctx context.Context, companyID, typeID, fieldID int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteOrderField(ctx, gen.DeleteOrderFieldParams{ID: fieldID, TypeID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errFieldNotFound
		}
		if err != nil {
			return err
		}
		used, err := q.CountOrderFieldOrders(ctx, fieldID)
		if err != nil {
			return err
		}
		if used > 0 {
			return apperr.New(apperr.Conflict, "field_in_use", fmt.Sprintf("Bu maydon %d ta vazifada to'ldirilgan", used))
		}
		return nil
	})
}

// ReorderFields puts the fields of the company's type in the order of ids,
// which has to name each of them once and nothing else.
func (s *Service) ReorderFields(ctx context.Context, companyID, typeID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetOrderType(ctx, gen.GetOrderTypeParams{ID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTypeNotFound
		}
		if err != nil {
			return err
		}
		all, err := q.ListOrderFields(ctx, companyID)
		if err != nil {
			return err
		}
		var live []int64
		for _, f := range all {
			if f.TypeID == typeID {
				live = append(live, f.ID)
			}
		}
		if !fields.SameIDs(ids, live) {
			return fields.ErrOrderChanged
		}
		return q.ReorderOrderFields(ctx, gen.ReorderOrderFieldsParams{TypeID: typeID, Ids: ids})
	})
}
