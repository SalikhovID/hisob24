package warehouse

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

const (
	ali  = "998901111111"
	vali = "998902222222"
)

// shop is a company with Ali (owner, "Ali aka") and Vali (user, no name),
// and two locations.
type shop struct {
	company, asosiy, chilonzor int64
}

// scope is a member's reach in the shop: every location unless some are
// given (none: a member with no location).
func (s shop) scope(locations ...int64) Scope {
	if locations == nil {
		locations = []int64{s.asosiy, s.chilonzor}
	}
	return Scope{CompanyID: s.company, LocationIDs: locations}
}

func newService(t *testing.T) (*Service, *pgxpool.Pool) {
	t.Helper()
	t.Parallel()
	pool := pgtest.New(t)
	return NewService(pool), pool
}

func newShop(t *testing.T, pool *pgxpool.Pool, name string) shop {
	t.Helper()
	ctx := t.Context()
	var s shop
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO companies (name, end_date) VALUES ($1, CURRENT_DATE) RETURNING id", name).Scan(&s.company))
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ($1), ($2) ON CONFLICT DO NOTHING", ali, vali)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, "INSERT INTO user_companies (user_phone, company_id, role, full_name) VALUES ($1, $2, 'owner', 'Ali aka'), ($3, $2, 'user', NULL)", ali, s.company, vali)
	require.NoError(t, err)
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING id", s.company).Scan(&s.asosiy))
	require.NoError(t, pool.QueryRow(ctx, "INSERT INTO locations (company_id, name) VALUES ($1, 'Chilonzor') RETURNING id", s.company).Scan(&s.chilonzor))
	return s
}

// addProduct enters a product with the unit or, with no unit, a service,
// active or not, and returns its id.
func addProduct(t *testing.T, pool *pgxpool.Pool, companyID int64, name string, unit *string, active bool) int64 {
	t.Helper()
	kind := "product"
	if unit == nil {
		kind = "service"
	}
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), "INSERT INTO products (company_id, kind, name, unit, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
		companyID, kind, name, unit, active, ali).Scan(&id))
	return id
}

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

func TestCreateSupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")

	sup, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: " Bozor ", Phone: ptr("+998 90 123-45-67"), Note: ptr(" Chorsu ")})
	require.NoError(t, err)
	assert.Positive(t, sup.ID)
	assert.Equal(t, "Bozor", sup.Name, "trimmed")
	assert.Equal(t, ptr("998901234567"), sup.Phone, "normalized")
	assert.Equal(t, ptr("Chorsu"), sup.Note)
	assert.True(t, sup.Active)
	assert.Equal(t, "0.00", sup.Balance, "nothing owed")
	assert.Equal(t, "0.00", sup.PurchasesTotal)
	assert.Equal(t, "0.00", sup.PaymentsTotal)
	assert.Equal(t, ptr("Ali aka"), sup.CreatedByName)
	assert.Equal(t, sup.CreatedAt, sup.UpdatedAt)

	plain, err := s.CreateSupplier(ctx, olma.company, vali, SupplierInput{Name: "Dehqon", Phone: ptr(" ")})
	require.NoError(t, err)
	assert.Nil(t, plain.Phone, "a blank phone is none")
	assert.Nil(t, plain.CreatedByName, "Vali goes by no name")

	for name, tc := range map[string]struct {
		in      SupplierInput
		message string
	}{
		"no name":       {SupplierInput{Name: " "}, "Nomni kiriting"},
		"a long name":   {SupplierInput{Name: strings.Repeat("a", 121)}, "Nom 120 belgidan oshmasin"},
		"a bad phone":   {SupplierInput{Name: "X", Phone: ptr("12345")}, "Telefon raqami noto'g'ri"},
		"a foreign one": {SupplierInput{Name: "X", Phone: ptr("+7 900 000 00 00")}, "Telefon raqami noto'g'ri"},
		"a long note":   {SupplierInput{Name: "X", Note: ptr(strings.Repeat("x", 501))}, "Izoh 500 belgidan oshmasin"},
	} {
		_, err := s.CreateSupplier(ctx, olma.company, ali, tc.in)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "BOZOR"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	_, err = s.CreateSupplier(ctx, nok.company, ali, SupplierInput{Name: "Bozor"})
	assert.NoError(t, err, "another company has its own names")
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon 2", Phone: ptr("998901234567")})
	assert.NoError(t, err, "a phone may repeat")
}

// nameOf is the id of the company's supplier called name.
func nameOf(t *testing.T, s *Service, companyID int64, name string) int64 {
	t.Helper()
	page, err := s.ListSuppliers(t.Context(), companyID, SupplierListInput{Search: name, Page: 1})
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	return page.Items[0].ID
}

func TestListSuppliers(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	for _, name := range []string{"Chorsu", "bozor", "Anhor"} {
		_, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: name})
		require.NoError(t, err)
	}
	dehqon, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Dehqon", Phone: ptr("998909998877")})
	require.NoError(t, err)
	anhor := nameOf(t, s, olma.company, "Anhor")
	_, err = s.SetSupplierActive(ctx, olma.company, anhor, false)
	require.NoError(t, err)
	names := func(in SupplierListInput) []string {
		page, err := s.ListSuppliers(ctx, olma.company, in)
		require.NoError(t, err)
		out := make([]string, 0, len(page.Items))
		for _, x := range page.Items {
			out = append(out, x.Name)
		}
		return out
	}

	assert.Equal(t, []string{"bozor", "Chorsu", "Dehqon"}, names(SupplierListInput{Page: 1}), "the active ones by name, whatever the case")
	assert.Equal(t, []string{"Anhor"}, names(SupplierListInput{Status: "inactive", Page: 1}))
	assert.Equal(t, []string{"bozor"}, names(SupplierListInput{Search: "ZOR", Page: 1}), "by name")
	assert.Equal(t, []string{"Dehqon"}, names(SupplierListInput{Search: "99 988", Page: 1}), "digits search the phone")
	assert.Empty(t, names(SupplierListInput{Search: "%", Page: 1}), "a wildcard is a character")
	page, err := s.ListSuppliers(ctx, olma.company, SupplierListInput{Page: 1})
	require.NoError(t, err)
	assert.EqualValues(t, 3, page.Total)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, PageSize, page.PageSize)
	assert.Equal(t, dehqon.ID, page.Items[2].ID)
	page, err = s.ListSuppliers(ctx, olma.company, SupplierListInput{Page: 2})
	require.NoError(t, err)
	assert.Empty(t, page.Items, "past the last page")
	_, err = s.ListSuppliers(ctx, olma.company, SupplierListInput{Status: "all", Page: 1})
	refused(t, err, apperr.Invalid, "validation_error", "Holat noto'g'ri")
	_, err = s.ListSuppliers(ctx, olma.company, SupplierListInput{Page: 0})
	refused(t, err, apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri")
}

func TestGetUpdateAndTurnOffASupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Chorsu"})
	require.NoError(t, err)

	got, err := s.GetSupplier(ctx, olma.company, bozor.ID)
	require.NoError(t, err)
	assert.Equal(t, bozor, got)
	_, err = s.GetSupplier(ctx, nok.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's")

	saved, err := s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: "Eski bozor", Phone: ptr("998901234567")})
	require.NoError(t, err)
	assert.Equal(t, "Eski bozor", saved.Name)
	assert.Equal(t, ptr("998901234567"), saved.Phone)
	assert.Nil(t, saved.Note, "left out: cleared")
	assert.True(t, saved.UpdatedAt.After(bozor.UpdatedAt))
	_, err = s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: "chorsu"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli ta'minotchi allaqachon bor")
	_, err = s.UpdateSupplier(ctx, olma.company, bozor.ID, SupplierInput{Name: " "})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting")
	_, err = s.UpdateSupplier(ctx, olma.company, 999999, SupplierInput{Name: " "})
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "the record comes first")

	off, err := s.SetSupplierActive(ctx, olma.company, bozor.ID, false)
	require.NoError(t, err)
	assert.False(t, off.Active)
	on, err := s.SetSupplierActive(ctx, olma.company, bozor.ID, true)
	require.NoError(t, err)
	assert.True(t, on.Active)
	_, err = s.SetSupplierActive(ctx, nok.company, bozor.ID, false)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
}

func TestDeleteSupplier(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, pool, "Olma")
	nok := newShop(t, pool, "Nok")
	bozor, err := s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	require.NoError(t, err)
	olmaID := addProduct(t, pool, olma.company, "Olma", ptr("kg"), true)

	err = s.DeleteSupplier(ctx, nok.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "another company's")

	// In a live purchase: kept.
	one, err := s.CreatePurchase(ctx, olma.scope(), ali, olma.asosiy, PurchaseInput{SupplierID: bozor.ID, PurchasedOn: "2026-10-07", Items: []ItemInput{line(olmaID, "1", "1000")}})
	require.NoError(t, err)
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.Conflict, "supplier_in_use", "Bu ta'minotchida 1 ta xarid bor")
	require.NoError(t, s.DeletePurchase(ctx, olma.scope(), one.ID))

	// With live payments: kept.
	_, err = s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("500"), PaidOn: "2026-10-07"})
	require.NoError(t, err)
	_, err = s.AddPayment(ctx, olma.company, ali, bozor.ID, PaymentInput{Amount: ptr("500"), PaidOn: "2026-10-07"})
	require.NoError(t, err)
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.Conflict, "supplier_in_use", "Bu ta'minotchida 2 ta to'lov bor", "no purchase, but payments")
	_, err = pool.Exec(ctx, "UPDATE supplier_payments SET deleted_at = now() WHERE supplier_id = $1", bozor.ID)
	require.NoError(t, err)

	require.NoError(t, s.DeleteSupplier(ctx, olma.company, bozor.ID))
	_, err = s.GetSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi")
	err = s.DeleteSupplier(ctx, olma.company, bozor.ID)
	refused(t, err, apperr.NotFound, "not_found", "Ta'minotchi topilmadi", "deleted already")
	_, err = s.CreateSupplier(ctx, olma.company, ali, SupplierInput{Name: "Bozor"})
	assert.NoError(t, err, "the name is free again")
}
