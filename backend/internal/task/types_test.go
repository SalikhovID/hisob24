package task

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// addDropdown inserts a dropdown of the company, as its owner would make
// one in the customer settings, and returns its id.
func addDropdown(t *testing.T, pool *pgxpool.Pool, companyID int64, name string) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(),
		"INSERT INTO customer_dropdowns (company_id, name) VALUES ($1, $2) RETURNING id", companyID, name).Scan(&id))
	return id
}

func TestCreateType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	tt, err := s.CreateType(ctx, olma, " Buyurtma ")

	require.NoError(t, err)
	assert.NotZero(t, tt.ID)
	assert.Equal(t, "Buyurtma", tt.Name, "the name is trimmed")
	assert.Equal(t, []Field{}, tt.Fields, "a new type has no fields")

	_, err = s.CreateType(ctx, olma, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateType(ctx, olma, "BUYURTMA")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor", "the name in another case")
	_, err = s.CreateType(ctx, nok, "Buyurtma")
	assert.NoError(t, err, "another company may take the name")
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM task_types WHERE company_id = $1", olma), "a refusal adds nothing")
}

func mustType(t *testing.T, s *Service, companyID int64, name string) Type {
	t.Helper()
	tt, err := s.CreateType(t.Context(), companyID, name)
	require.NoError(t, err)
	return tt
}

// fieldRow inserts a field as it would stand after the owner's changes: at a
// place of its own, with its mark.
func fieldRow(t *testing.T, pool *pgxpool.Pool, companyID, typeID int64, f Field, position int) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO task_fields
			(company_id, type_id, label, kind, dropdown_id, required, position)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		companyID, typeID, f.Label, f.Kind, f.DropdownID, f.Required, position).Scan(&id))
	return id
}

func TestTypes(t *testing.T) {
	s, pool := newService(t)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	qongiroq := mustType(t, s, olma, "Qo'ng'iroq")
	mustType(t, s, nok, "Begona")
	manba := addDropdown(t, pool, olma, "Manba")
	source := Field{Label: "Manba", Kind: "dropdown", DropdownID: &manba}
	source.ID = fieldRow(t, pool, olma, buyurtma.ID, source, 2)
	izoh := Field{Label: "Izoh", Kind: "string", Required: true}
	izoh.ID = fieldRow(t, pool, olma, buyurtma.ID, izoh, 1)
	sabab := Field{Label: "Sabab", Kind: "string", Required: true}
	sabab.ID = fieldRow(t, pool, olma, shikoyat.ID, sabab, 1)

	list, err := s.Types(t.Context(), olma)

	require.NoError(t, err)
	assert.Equal(t, []Type{
		{ID: buyurtma.ID, Name: "Buyurtma", Fields: []Field{izoh, source}},
		{ID: shikoyat.ID, Name: "Shikoyat", Fields: []Field{sabab}},
		{ID: qongiroq.ID, Name: "Qo'ng'iroq", Fields: []Field{}},
	}, list, "the company's types in their order, each with its fields in theirs")
}

func TestRenameType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	mustType(t, s, olma, "Shikoyat")
	izoh := Field{Label: "Izoh", Kind: "string", Required: true}
	izoh.ID = fieldRow(t, pool, olma, buyurtma.ID, izoh, 1)

	tt, err := s.RenameType(ctx, olma, buyurtma.ID, " Zakaz ")

	require.NoError(t, err)
	assert.Equal(t, Type{ID: buyurtma.ID, Name: "Zakaz", Fields: []Field{izoh}}, tt, "the type under its new name, with its fields")

	const notFound = "Tur topilmadi"
	_, err = s.RenameType(ctx, olma, buyurtma.ID, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.RenameType(ctx, olma, buyurtma.ID, "SHIKOYAT")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor", "another type's name")
	_, err = s.RenameType(ctx, nok, buyurtma.ID, "Begona")
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's type")
	_, err = s.RenameType(ctx, olma, buyurtma.ID+100, "Yo'q")
	refused(t, err, apperr.NotFound, "not_found", notFound, "no such type")
}

func typeNames(t *testing.T, s *Service, companyID int64) []string {
	t.Helper()
	list, err := s.Types(t.Context(), companyID)
	require.NoError(t, err)
	names := []string{}
	for _, tt := range list {
		names = append(names, tt.Name)
	}
	return names
}

func TestOrderTypes(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	qongiroq := mustType(t, s, olma, "Qo'ng'iroq")
	begona := mustType(t, s, nok, "Begona")

	require.NoError(t, s.OrderTypes(ctx, olma, []int64{qongiroq.ID, buyurtma.ID, shikoyat.ID}))

	assert.Equal(t, []string{"Qo'ng'iroq", "Buyurtma", "Shikoyat"}, typeNames(t, s, olma))

	const changed = "Ro'yxat o'zgargan. Sahifani yangilang"
	for about, ids := range map[string][]int64{
		"a type is missing":         {buyurtma.ID, shikoyat.ID},
		"another company's type":    {buyurtma.ID, shikoyat.ID, begona.ID},
		"a type named twice":        {buyurtma.ID, buyurtma.ID, shikoyat.ID},
		"more types than there are": {buyurtma.ID, shikoyat.ID, qongiroq.ID, begona.ID},
		"nothing at all":            {},
	} {
		refused(t, s.OrderTypes(ctx, olma, ids), apperr.Conflict, "order_changed", changed, about)
	}
	assert.Equal(t, []string{"Qo'ng'iroq", "Buyurtma", "Shikoyat"}, typeNames(t, s, olma), "a refusal moves nothing")

	mustType(t, s, olma, "Yangi")
	assert.Equal(t, []string{"Qo'ng'iroq", "Buyurtma", "Shikoyat", "Yangi"}, typeNames(t, s, olma), "a new type still goes last")
}

func TestDeleteType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	fieldRow(t, pool, olma, buyurtma.ID, Field{Label: "Izoh", Kind: "string"}, 1)
	fieldRow(t, pool, olma, buyurtma.ID, Field{Label: "Summa", Kind: "int"}, 2)
	sabab := Field{Label: "Sabab", Kind: "string"}
	sabab.ID = fieldRow(t, pool, olma, shikoyat.ID, sabab, 1)

	require.NoError(t, s.DeleteType(ctx, olma, buyurtma.ID))

	list, err := s.Types(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []Type{{ID: shikoyat.ID, Name: "Shikoyat", Fields: []Field{sabab}}}, list, "the type is gone from the company's")
	var live, rows int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FILTER (WHERE deleted_at IS NULL), count(*)
		FROM task_fields WHERE type_id = $1`, buyurtma.ID).Scan(&live, &rows))
	assert.Zero(t, live, "its fields are deleted with it")
	assert.Equal(t, 2, rows, "nothing leaves the database")
	again, err := s.CreateType(ctx, olma, "Buyurtma")
	require.NoError(t, err, "the deleted type's name is free again")
	assert.NotEqual(t, buyurtma.ID, again.ID)

	const notFound = "Tur topilmadi"
	refused(t, s.DeleteType(ctx, olma, buyurtma.ID), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.DeleteType(ctx, nok, shikoyat.ID), apperr.NotFound, "not_found", notFound, "another company's type")
}

func TestAddField(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	manba := addDropdown(t, pool, olma, "Manba")

	izoh, err := s.AddField(ctx, olma, buyurtma.ID, FieldInput{Label: " Izoh ", Kind: "string", Required: true})

	require.NoError(t, err)
	assert.NotZero(t, izoh.ID)
	assert.Equal(t, Field{ID: izoh.ID, Label: "Izoh", Kind: "string", Required: true}, izoh, "the name is trimmed")
	added := []Field{izoh}
	for _, in := range []FieldInput{
		{Label: "Summa", Kind: "int"},
		{Label: "Manba", Kind: "dropdown", DropdownID: &manba},
		{Label: "Kanallar", Kind: "multi_dropdown", DropdownID: &manba, Required: true},
		{Label: "Holat", Kind: "radio", DropdownID: &manba},
		{Label: "Qiziqish", Kind: "checkbox", DropdownID: &manba},
	} {
		f, err := s.AddField(ctx, olma, buyurtma.ID, in)
		require.NoError(t, err, in.Kind)
		assert.Equal(t, Field{ID: f.ID, Label: in.Label, Kind: in.Kind, Required: in.Required, DropdownID: in.DropdownID}, f, in.Kind)
		added = append(added, f)
	}
	list, err := s.Types(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, added, list[0].Fields, "the fields stand as they were added")
}

func TestAddFieldRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	manba := addDropdown(t, pool, olma, "Manba")
	begona := addDropdown(t, pool, nok, "Begona")
	eski := addDropdown(t, pool, olma, "Eski")
	_, err := pool.Exec(ctx, "UPDATE customer_dropdowns SET deleted_at = now() WHERE id = $1", eski)
	require.NoError(t, err)
	_, err = s.AddField(ctx, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	require.NoError(t, err)

	const (
		noKind     = "Maydon turini tanlang"
		noDropdown = "Dropdownni tanlang"
	)
	for about, tc := range map[string]struct {
		in      FieldInput
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":                           {FieldInput{Label: " ", Kind: "string"}, apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a kind that is not one of the six": {FieldInput{Label: "Sana", Kind: "date"}, apperr.Invalid, "validation_error", noKind},
		"no kind":                           {FieldInput{Label: "Sana"}, apperr.Invalid, "validation_error", noKind},
		"a choice field without a dropdown": {FieldInput{Label: "Manba", Kind: "dropdown"}, apperr.Invalid, "validation_error", noDropdown},
		"another company's dropdown":        {FieldInput{Label: "Manba", Kind: "radio", DropdownID: &begona}, apperr.Invalid, "validation_error", noDropdown},
		"a deleted dropdown":                {FieldInput{Label: "Manba", Kind: "checkbox", DropdownID: &eski}, apperr.Invalid, "validation_error", noDropdown},
		"a text field with a dropdown": {FieldInput{Label: "Tavsif", Kind: "string", DropdownID: &manba},
			apperr.Invalid, "validation_error", "Matn va son maydoniga dropdown ulanmaydi"},
		"the name is taken in the type": {FieldInput{Label: "izoh", Kind: "int"}, apperr.Conflict, "name_taken", "Bu nomli maydon allaqachon bor"},
	} {
		_, err := s.AddField(ctx, olma, buyurtma.ID, tc.in)
		refused(t, err, tc.kind, tc.code, tc.message, about)
	}
	_, err = s.AddField(ctx, nok, buyurtma.ID, FieldInput{Label: "Sabab", Kind: "string"})
	refused(t, err, apperr.NotFound, "not_found", "Tur topilmadi", "another company's type")
	assert.Equal(t, 1, count(t, pool, "SELECT count(*) FROM task_fields WHERE type_id = $1", buyurtma.ID), "a refusal adds nothing")
}

func mustField(t *testing.T, s *Service, companyID, typeID int64, in FieldInput) Field {
	t.Helper()
	f, err := s.AddField(t.Context(), companyID, typeID, in)
	require.NoError(t, err)
	return f
}

func TestUpdateField(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	manba := addDropdown(t, pool, olma, "Manba")
	izoh := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	source := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Manba", Kind: "dropdown", DropdownID: &manba})

	f, err := s.UpdateField(ctx, olma, buyurtma.ID, izoh.ID, FieldPatch{Label: ptr(" Tavsif "), Required: ptr(true)})
	require.NoError(t, err)
	assert.Equal(t, Field{ID: izoh.ID, Label: "Tavsif", Kind: "string", Required: true}, f)

	f, err = s.UpdateField(ctx, olma, buyurtma.ID, izoh.ID, FieldPatch{Label: ptr("Izoh")})
	require.NoError(t, err)
	assert.Equal(t, Field{ID: izoh.ID, Label: "Izoh", Kind: "string", Required: true}, f, "what is not given stays")

	f, err = s.UpdateField(ctx, olma, buyurtma.ID, source.ID, FieldPatch{Required: ptr(true)})
	require.NoError(t, err)
	assert.Equal(t, Field{ID: source.ID, Label: "Manba", Kind: "dropdown", Required: true, DropdownID: &manba}, f,
		"a choice field may be required; its kind and dropdown stay")

	const notFound = "Maydon topilmadi"
	_, err = s.UpdateField(ctx, olma, buyurtma.ID, izoh.ID, FieldPatch{Label: ptr(" ")})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.UpdateField(ctx, olma, buyurtma.ID, izoh.ID, FieldPatch{Label: ptr("MANBA")})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli maydon allaqachon bor", "another field's name")
	_, err = s.UpdateField(ctx, nok, buyurtma.ID, izoh.ID, FieldPatch{Label: ptr("Begona")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's field")
	_, err = s.UpdateField(ctx, olma, shikoyat.ID, izoh.ID, FieldPatch{Label: ptr("Begona")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "a field of another type")
}

func TestDeleteField(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	izoh := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	summa := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Summa", Kind: "int"})

	require.NoError(t, s.DeleteField(ctx, olma, buyurtma.ID, izoh.ID))

	list, err := s.Types(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []Field{summa}, list[0].Fields, "the field is gone from the type")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM task_fields WHERE type_id = $1", buyurtma.ID), "nothing leaves the database")
	again := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	assert.NotEqual(t, izoh.ID, again.ID, "the deleted field's name is free again")

	const notFound = "Maydon topilmadi"
	refused(t, s.DeleteField(ctx, olma, buyurtma.ID, izoh.ID), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.DeleteField(ctx, nok, buyurtma.ID, summa.ID), apperr.NotFound, "not_found", notFound, "another company's field")
	refused(t, s.DeleteField(ctx, olma, shikoyat.ID, summa.ID), apperr.NotFound, "not_found", notFound, "a field of another type")
}

func TestOrderFields(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	buyurtma := mustType(t, s, olma, "Buyurtma")
	shikoyat := mustType(t, s, olma, "Shikoyat")
	izoh := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Izoh", Kind: "string"})
	summa := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Summa", Kind: "int"})
	manzil := mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Manzil", Kind: "string"})
	sabab := mustField(t, s, olma, shikoyat.ID, FieldInput{Label: "Sabab", Kind: "string"})
	labels := func() []string {
		list, err := s.Types(ctx, olma)
		require.NoError(t, err)
		names := []string{}
		for _, f := range list[0].Fields {
			names = append(names, f.Label)
		}
		return names
	}

	require.NoError(t, s.OrderFields(ctx, olma, buyurtma.ID, []int64{manzil.ID, izoh.ID, summa.ID}))

	assert.Equal(t, []string{"Manzil", "Izoh", "Summa"}, labels())

	const changed = "Ro'yxat o'zgargan. Sahifani yangilang"
	for about, ids := range map[string][]int64{
		"a field is missing":         {izoh.ID, summa.ID},
		"a field of another type":    {izoh.ID, summa.ID, sabab.ID},
		"a field named twice":        {izoh.ID, izoh.ID, summa.ID},
		"more fields than there are": {izoh.ID, summa.ID, manzil.ID, sabab.ID},
	} {
		refused(t, s.OrderFields(ctx, olma, buyurtma.ID, ids), apperr.Conflict, "order_changed", changed, about)
	}
	refused(t, s.OrderFields(ctx, nok, buyurtma.ID, []int64{izoh.ID, summa.ID, manzil.ID}),
		apperr.NotFound, "not_found", "Tur topilmadi", "another company's type")
	assert.Equal(t, []string{"Manzil", "Izoh", "Summa"}, labels(), "a refusal moves nothing")

	mustField(t, s, olma, buyurtma.ID, FieldInput{Label: "Yangi", Kind: "string"})
	assert.Equal(t, []string{"Manzil", "Izoh", "Summa", "Yangi"}, labels(), "a new field still goes last")
}
