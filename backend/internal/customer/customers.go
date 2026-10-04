package customer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// Customer is a customer of a company: its type, its phone and its answers
// to the fields of the type.
type Customer struct {
	ID     int64
	TypeID int64
	Phone  string
	Values Values
	// CreatedByName is the name the member who entered the customer goes by
	// in the company; nil when they go by none.
	CreatedByName *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Input is what a customer is saved with, as the client sent it: the phone
// and the answers by the id of the field.
type Input struct {
	Phone  string
	Values map[string]json.RawMessage
}

// Create enters a customer of the company's type, with the answers to the
// type's fields. by is the phone of the member who enters it.
func (s *Service) Create(ctx context.Context, companyID int64, by string, typeID int64, in Input) (Customer, error) {
	phone, err := customerPhone(in.Phone)
	if err != nil {
		return Customer{}, err
	}
	var c Customer
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: typeID, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return invalid("Mijoz turini tanlang")
		}
		if err != nil {
			return err
		}
		fields, options, err := formOf(ctx, q, companyID, typeID)
		if err != nil {
			return err
		}
		values, err := checkValues(fields, options, nil, in.Values)
		if err != nil {
			return err
		}
		name, err := q.GetMemberName(ctx, gen.GetMemberNameParams{UserPhone: by, CompanyID: companyID})
		if err != nil {
			return err
		}
		row, err := q.CreateCustomer(ctx, gen.CreateCustomerParams{
			CompanyID: companyID, TypeID: typeID, Phone: phone, CreatedBy: by, CreatedByName: name,
		})
		if err != nil {
			return err
		}
		if err := store(ctx, q, row.ID, fields, values); err != nil {
			return err
		}
		c = Customer{
			ID: row.ID, TypeID: row.TypeID, Phone: row.Phone, Values: values,
			CreatedByName: name, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		}
		return nil
	})
	if err != nil {
		return Customer{}, err
	}
	return c, nil
}

// formOf is what the form of a type asks and offers: the type's fields in
// their order, and the options of the company's dropdowns, each dropdown's
// in its order.
func formOf(ctx context.Context, q *gen.Queries, companyID, typeID int64) ([]Field, map[int64][]Option, error) {
	all, err := q.ListCustomerFields(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	var fields []Field
	for _, f := range all {
		if f.TypeID == typeID {
			fields = append(fields, toField(f))
		}
	}
	rows, err := q.ListCustomerDropdownOptions(ctx, companyID)
	if err != nil {
		return nil, nil, err
	}
	options := map[int64][]Option{}
	for _, o := range rows {
		options[o.DropdownID] = append(options[o.DropdownID], toOption(o))
	}
	return fields, options, nil
}

// store writes a customer's answers to the fields.
func store(ctx context.Context, q *gen.Queries, customerID int64, fields []Field, values Values) error {
	for _, f := range fields {
		for _, row := range valueRows(f, values[f.ID]) {
			row.CustomerID = customerID
			if err := q.AddCustomerValue(ctx, row); err != nil {
				return err
			}
		}
	}
	return nil
}

// valueRows is an answer as it is stored: a row for a text or a number, a
// row for each option chosen, none for no answer.
func valueRows(f Field, answer any) []gen.AddCustomerValueParams {
	switch a := answer.(type) {
	case string:
		return []gen.AddCustomerValueParams{{FieldID: f.ID, TextValue: &a}}
	case int64:
		if choice, _ := kindOf(f.Kind); choice {
			return []gen.AddCustomerValueParams{{FieldID: f.ID, OptionID: &a}}
		}
		return []gen.AddCustomerValueParams{{FieldID: f.ID, IntValue: &a}}
	case []int64:
		rows := make([]gen.AddCustomerValueParams, 0, len(a))
		for _, id := range a {
			rows = append(rows, gen.AddCustomerValueParams{FieldID: f.ID, OptionID: &id})
		}
		return rows
	}
	return nil
}

// customerPhone is a customer's phone as it is kept: an Uzbek number, 998
// and nine digits.
func customerPhone(raw string) (string, error) {
	phone, err := user.NormalizePhone(raw)
	if err != nil || len(phone) != 12 || !strings.HasPrefix(phone, "998") {
		return "", invalid("Telefon raqami noto'g'ri")
	}
	return phone, nil
}
