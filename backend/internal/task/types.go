package task

import (
	"context"
	"errors"

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

// Field is one question of a task type: the shape the customer fields have,
// but a task field is never told not to repeat.
type Field = fields.Field

// Type is a kind of task (Buyurtma, Shikoyat) with the fields its form asks
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
	var tt gen.TaskType
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		tt, err = q.CreateTaskType(ctx, gen.CreateTaskTypeParams{CompanyID: companyID, Name: name})
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
	rows, err := s.q.ListTaskTypes(ctx, companyID)
	if err != nil {
		return nil, err
	}
	all, err := s.q.ListTaskFields(ctx, companyID)
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

func toField(f gen.TaskField) Field {
	return Field{ID: f.ID, Label: f.Label, Kind: f.Kind, Required: f.Required, DropdownID: f.DropdownID}
}

// RenameType gives the company's type another name.
func (s *Service) RenameType(ctx context.Context, companyID, id int64, name string) (Type, error) {
	name, err := fields.CleanName(name)
	if err != nil {
		return Type{}, err
	}
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.RenameTaskType(ctx, gen.RenameTaskTypeParams{ID: id, CompanyID: companyID, Name: name})
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
	return s.taskType(ctx, companyID, id)
}

// taskType is the company's type with its fields.
func (s *Service) taskType(ctx context.Context, companyID, id int64) (Type, error) {
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
		rows, err := q.ListTaskTypes(ctx, companyID)
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
		return q.OrderTaskTypes(ctx, gen.OrderTaskTypesParams{CompanyID: companyID, Ids: ids})
	})
}

// DeleteType hides the company's type and its fields with it; the type's
// name is free again.
func (s *Service) DeleteType(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.DeleteTaskType(ctx, gen.DeleteTaskTypeParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTypeNotFound
		}
		if err != nil {
			return err
		}
		return q.DeleteTaskTypeFields(ctx, id)
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
	var f gen.TaskField
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
		f, err = q.AddTaskField(ctx, gen.AddTaskFieldParams{
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
	var f gen.TaskField
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		var err error
		f, err = q.UpdateTaskField(ctx, gen.UpdateTaskFieldParams{
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
		_, err := q.DeleteTaskField(ctx, gen.DeleteTaskFieldParams{ID: fieldID, TypeID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errFieldNotFound
		}
		return err
	})
}

// OrderFields puts the fields of the company's type in the order of ids,
// which has to name each of them once and nothing else.
func (s *Service) OrderFields(ctx context.Context, companyID, typeID int64, ids []int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetTaskType(ctx, gen.GetTaskTypeParams{ID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errTypeNotFound
		}
		if err != nil {
			return err
		}
		all, err := q.ListTaskFields(ctx, companyID)
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
		return q.OrderTaskFields(ctx, gen.OrderTaskFieldsParams{TypeID: typeID, Ids: ids})
	})
}
