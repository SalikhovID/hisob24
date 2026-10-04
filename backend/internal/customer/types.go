package customer

import (
	"context"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

var errTypeNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor")

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
