package warehouse

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/customer"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// uzbekPhone is a supplier's phone as it is kept: an Uzbek number, as the
// table checks it.
var uzbekPhone = regexp.MustCompile(`^998\d{9}$`)

// Supplier is a supplier of a company, as the API shows it, with its
// balance: what its live purchases come to, what its live payments come to,
// and the difference (owed above zero, an advance below).
type Supplier struct {
	ID             int64
	Name           string
	Phone          *string
	Note           *string
	Active         bool
	PurchasesTotal string
	PaymentsTotal  string
	Balance        string
	CreatedByName  *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// SupplierInput is what a supplier is saved with, as the client sent it.
type SupplierInput struct {
	Name  string
	Phone *string
	Note  *string
}

// SupplierListInput narrows the list: Status active (the default) or
// inactive, Search looked for in the names, or, when it is digits, in the
// phones. Page starts at 1.
type SupplierListInput struct {
	Status string
	Search string
	Page   int
}

// SupplierPage is one page of the suppliers and how many there are on all.
type SupplierPage struct {
	Items    []Supplier
	Total    int64
	Page     int
	PageSize int
}

// checkedSupplier is an input as it is kept: the name clean, the phone
// normalized or none, the note trimmed or none.
type checkedSupplier struct {
	Name  string
	Phone *string
	Note  *string
}

// checkSupplier reads an input. What is wrong is told in this order: the
// name, the phone, the note.
func checkSupplier(in SupplierInput) (checkedSupplier, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return checkedSupplier{}, err
	}
	c := checkedSupplier{Name: name}
	if raw := trimmed(in.Phone); raw != nil {
		phone, err := user.NormalizePhone(*raw)
		if err != nil || !uzbekPhone.MatchString(phone) {
			return checkedSupplier{}, invalid("Telefon raqami noto'g'ri")
		}
		c.Phone = &phone
	}
	if c.Note, err = cleanOptional(in.Note, MaxNote, "Izoh 500 belgidan oshmasin"); err != nil {
		return checkedSupplier{}, err
	}
	return c, nil
}

// pageOf reads a page number: from 1, inside int32 offsets.
func pageOf(page int) error {
	if page < 1 || page > maxPage {
		return invalid("Sahifa raqami noto'g'ri")
	}
	return nil
}

// activeOf reads a status: active (the default) or inactive.
func activeOf(status string) (bool, error) {
	switch status {
	case "", "active":
		return true, nil
	case "inactive":
		return false, nil
	}
	return false, invalid("Holat noto'g'ri")
}

func toSupplier(r gen.GetSupplierRow) Supplier {
	return Supplier{
		ID: r.ID, Name: r.Name, Phone: r.Phone, Note: r.Note, Active: r.IsActive,
		PurchasesTotal: amount(r.PurchasesTotal), PaymentsTotal: amount(r.PaymentsTotal), Balance: amount(r.Balance),
		CreatedByName: r.CreatedByName, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func getSupplier(ctx context.Context, q *gen.Queries, companyID, id int64) (Supplier, error) {
	r, err := q.GetSupplier(ctx, gen.GetSupplierParams{ID: id, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Supplier{}, errSupplierNotFound
	}
	if err != nil {
		return Supplier{}, err
	}
	return toSupplier(r), nil
}

// ListSuppliers is a page of the company's suppliers, by name, each with
// its balance: the active ones unless the inactive are asked for; a search
// looks in the names, or, when it is digits, in the phones.
func (s *Service) ListSuppliers(ctx context.Context, companyID int64, in SupplierListInput) (SupplierPage, error) {
	if err := pageOf(in.Page); err != nil {
		return SupplierPage{}, err
	}
	active, err := activeOf(in.Status)
	if err != nil {
		return SupplierPage{}, err
	}
	search, digits := customer.SearchOf(in.Search)
	total, err := s.q.CountSuppliers(ctx, gen.CountSuppliersParams{CompanyID: companyID, IsActive: active, Search: search, Digits: digits})
	if err != nil {
		return SupplierPage{}, err
	}
	rows, err := s.q.ListSuppliers(ctx, gen.ListSuppliersParams{
		CompanyID: companyID, IsActive: active, Search: search, Digits: digits,
		Limit: PageSize, Offset: int32((in.Page - 1) * PageSize),
	})
	if err != nil {
		return SupplierPage{}, err
	}
	items := make([]Supplier, 0, len(rows))
	for _, r := range rows {
		items = append(items, toSupplier(gen.GetSupplierRow(r)))
	}
	return SupplierPage{Items: items, Total: total, Page: in.Page, PageSize: PageSize}, nil
}

// GetSupplier is the company's supplier, with its balance.
func (s *Service) GetSupplier(ctx context.Context, companyID, id int64) (Supplier, error) {
	return getSupplier(ctx, s.q, companyID, id)
}

// CreateSupplier enters a supplier into the company, as the member with
// phone by. What is wrong is told in the order of checkSupplier, then a
// name another supplier has (409).
func (s *Service) CreateSupplier(ctx context.Context, companyID int64, by string, in SupplierInput) (Supplier, error) {
	c, err := checkSupplier(in)
	if err != nil {
		return Supplier{}, err
	}
	var sup Supplier
	err = s.write(ctx, companyID, func(q *gen.Queries) error {
		name, err := memberName(ctx, q, companyID, by)
		if err != nil {
			return err
		}
		row, err := q.CreateSupplier(ctx, gen.CreateSupplierParams{
			CompanyID: companyID, Name: c.Name, Phone: c.Phone, Note: c.Note, CreatedBy: by, CreatedByName: name,
		})
		if fields.Taken(err) {
			return errSupplierNameTaken
		}
		if err != nil {
			return err
		}
		sup, err = getSupplier(ctx, q, companyID, row.ID)
		return err
	})
	return sup, err
}

// UpdateSupplier saves the company's supplier with other fields; what is
// left out is cleared. The record itself comes first: one that is not there
// is not found.
func (s *Service) UpdateSupplier(ctx context.Context, companyID, id int64, in SupplierInput) (Supplier, error) {
	var sup Supplier
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, id); err != nil {
			return err
		}
		c, err := checkSupplier(in)
		if err != nil {
			return err
		}
		_, err = q.UpdateSupplier(ctx, gen.UpdateSupplierParams{ID: id, CompanyID: companyID, Name: c.Name, Phone: c.Phone, Note: c.Note})
		if fields.Taken(err) {
			return errSupplierNameTaken
		}
		if err != nil {
			return err
		}
		sup, err = getSupplier(ctx, q, companyID, id)
		return err
	})
	return sup, err
}

// SetSupplierActive turns the company's supplier off (offered to no new
// purchase) or on again.
func (s *Service) SetSupplierActive(ctx context.Context, companyID, id int64, active bool) (Supplier, error) {
	var sup Supplier
	err := s.write(ctx, companyID, func(q *gen.Queries) error {
		_, err := q.SetSupplierActive(ctx, gen.SetSupplierActiveParams{ID: id, CompanyID: companyID, IsActive: active})
		if errors.Is(err, pgx.ErrNoRows) {
			return errSupplierNotFound
		}
		if err != nil {
			return err
		}
		sup, err = getSupplier(ctx, q, companyID, id)
		return err
	})
	return sup, err
}

// DeleteSupplier hides the company's supplier; its name is free again. One
// with live purchases, or with live payments, is refused (409): it may be
// turned off instead (logic/warehouse.md, 3.2).
func (s *Service) DeleteSupplier(ctx context.Context, companyID, id int64) error {
	return s.write(ctx, companyID, func(q *gen.Queries) error {
		if _, err := getSupplier(ctx, q, companyID, id); err != nil {
			return err
		}
		purchases, err := q.CountSupplierPurchases(ctx, id)
		if err != nil {
			return err
		}
		if purchases > 0 {
			return apperr.New(apperr.Conflict, "supplier_in_use", fmt.Sprintf("Bu ta'minotchida %d ta xarid bor", purchases))
		}
		payments, err := q.CountSupplierPayments(ctx, id)
		if err != nil {
			return err
		}
		if payments > 0 {
			return apperr.New(apperr.Conflict, "supplier_in_use", fmt.Sprintf("Bu ta'minotchida %d ta to'lov bor", payments))
		}
		_, err = q.DeleteSupplier(ctx, gen.DeleteSupplierParams{ID: id, CompanyID: companyID})
		return err
	})
}
