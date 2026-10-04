package customer

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	ct, err := s.CreateType(ctx, olma, " Jismoniy ")

	require.NoError(t, err)
	assert.NotZero(t, ct.ID)
	assert.Equal(t, "Jismoniy", ct.Name, "the name is trimmed")
	assert.Equal(t, []Field{}, ct.Fields, "a new type has no fields")

	_, err = s.CreateType(ctx, olma, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateType(ctx, olma, "JISMONIY")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor", "the name in another case")
	_, err = s.CreateType(ctx, nok, "Jismoniy")
	assert.NoError(t, err, "another company may take the name")
	var types int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_types WHERE company_id = $1", olma).Scan(&types))
	assert.Equal(t, 1, types, "a refusal adds nothing")
}

func mustType(t *testing.T, s *Service, companyID int64, name string) Type {
	t.Helper()
	ct, err := s.CreateType(t.Context(), companyID, name)
	require.NoError(t, err)
	return ct
}

// fieldRow inserts a field as it would stand after the owner's changes: at a
// place of its own, with its marks.
func fieldRow(t *testing.T, pool *pgxpool.Pool, companyID, typeID int64, f Field, position int) int64 {
	t.Helper()
	var id int64
	require.NoError(t, pool.QueryRow(t.Context(), `INSERT INTO customer_fields
			(company_id, type_id, label, kind, dropdown_id, required, is_unique, position)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		companyID, typeID, f.Label, f.Kind, f.DropdownID, f.Required, f.Unique, position).Scan(&id))
	return id
}

func TestTypes(t *testing.T) {
	s, pool := newService(t)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	jismoniy := mustType(t, s, olma, "Jismoniy")
	yuridik := mustType(t, s, olma, "Yuridik")
	hamkor := mustType(t, s, olma, "Hamkor")
	mustType(t, s, nok, "Begona")
	manba := mustDropdown(t, s, olma, "Manba")
	source := Field{Label: "Manba", Kind: "dropdown", DropdownID: &manba.ID}
	source.ID = fieldRow(t, pool, olma, jismoniy.ID, source, 2)
	fish := Field{Label: "F.I.Sh.", Kind: "string", Required: true}
	fish.ID = fieldRow(t, pool, olma, jismoniy.ID, fish, 1)
	inn := Field{Label: "INN", Kind: "int", Required: true, Unique: true}
	inn.ID = fieldRow(t, pool, olma, yuridik.ID, inn, 1)

	list, err := s.Types(t.Context(), olma)

	require.NoError(t, err)
	assert.Equal(t, []Type{
		{ID: jismoniy.ID, Name: "Jismoniy", Fields: []Field{fish, source}},
		{ID: yuridik.ID, Name: "Yuridik", Fields: []Field{inn}},
		{ID: hamkor.ID, Name: "Hamkor", Fields: []Field{}},
	}, list, "the company's types in their order, each with its fields in theirs")
}

func TestRenameType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	jismoniy := mustType(t, s, olma, "Jismoniy")
	mustType(t, s, olma, "Yuridik")
	fish := Field{Label: "F.I.Sh.", Kind: "string", Required: true}
	fish.ID = fieldRow(t, pool, olma, jismoniy.ID, fish, 1)

	ct, err := s.RenameType(ctx, olma, jismoniy.ID, " Shaxs ")

	require.NoError(t, err)
	assert.Equal(t, Type{ID: jismoniy.ID, Name: "Shaxs", Fields: []Field{fish}}, ct, "the type under its new name, with its fields")

	const notFound = "Tur topilmadi"
	_, err = s.RenameType(ctx, olma, jismoniy.ID, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.RenameType(ctx, olma, jismoniy.ID, "YURIDIK")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor", "another type's name")
	_, err = s.RenameType(ctx, nok, jismoniy.ID, "Begona")
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's type")
	_, err = s.RenameType(ctx, olma, jismoniy.ID+100, "Yo'q")
	refused(t, err, apperr.NotFound, "not_found", notFound, "no such type")
}

func typeNames(t *testing.T, s *Service, companyID int64) []string {
	t.Helper()
	list, err := s.Types(t.Context(), companyID)
	require.NoError(t, err)
	names := []string{}
	for _, ct := range list {
		names = append(names, ct.Name)
	}
	return names
}

func TestOrderTypes(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	jismoniy := mustType(t, s, olma, "Jismoniy")
	yuridik := mustType(t, s, olma, "Yuridik")
	hamkor := mustType(t, s, olma, "Hamkor")
	begona := mustType(t, s, nok, "Begona")

	require.NoError(t, s.OrderTypes(ctx, olma, []int64{hamkor.ID, jismoniy.ID, yuridik.ID}))

	assert.Equal(t, []string{"Hamkor", "Jismoniy", "Yuridik"}, typeNames(t, s, olma))

	const changed = "Ro'yxat o'zgargan. Sahifani yangilang"
	for about, ids := range map[string][]int64{
		"a type is missing":          {jismoniy.ID, yuridik.ID},
		"another company's type":     {jismoniy.ID, yuridik.ID, begona.ID},
		"a type named twice":         {jismoniy.ID, jismoniy.ID, yuridik.ID},
		"more types than there are":  {jismoniy.ID, yuridik.ID, hamkor.ID, begona.ID},
		"nothing at all":             {},
	} {
		refused(t, s.OrderTypes(ctx, olma, ids), apperr.Conflict, "order_changed", changed, about)
	}
	assert.Equal(t, []string{"Hamkor", "Jismoniy", "Yuridik"}, typeNames(t, s, olma), "a refusal moves nothing")

	mustType(t, s, olma, "Yangi")
	assert.Equal(t, []string{"Hamkor", "Jismoniy", "Yuridik", "Yangi"}, typeNames(t, s, olma), "a new type still goes last")
}

func TestDeleteType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	jismoniy := mustType(t, s, olma, "Jismoniy")
	yuridik := mustType(t, s, olma, "Yuridik")
	fieldRow(t, pool, olma, jismoniy.ID, Field{Label: "F.I.Sh.", Kind: "string"}, 1)
	fieldRow(t, pool, olma, jismoniy.ID, Field{Label: "Yoshi", Kind: "int"}, 2)
	nomi := Field{Label: "Nomi", Kind: "string"}
	nomi.ID = fieldRow(t, pool, olma, yuridik.ID, nomi, 1)

	require.NoError(t, s.DeleteType(ctx, olma, jismoniy.ID))

	list, err := s.Types(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []Type{{ID: yuridik.ID, Name: "Yuridik", Fields: []Field{nomi}}}, list, "the type is gone from the company's")
	var live, rows int
	require.NoError(t, pool.QueryRow(ctx, `SELECT count(*) FILTER (WHERE deleted_at IS NULL), count(*)
		FROM customer_fields WHERE type_id = $1`, jismoniy.ID).Scan(&live, &rows))
	assert.Zero(t, live, "its fields are deleted with it")
	assert.Equal(t, 2, rows, "nothing leaves the database")
	again, err := s.CreateType(ctx, olma, "Jismoniy")
	require.NoError(t, err, "the deleted type's name is free again")
	assert.NotEqual(t, jismoniy.ID, again.ID)

	const notFound = "Tur topilmadi"
	refused(t, s.DeleteType(ctx, olma, jismoniy.ID), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.DeleteType(ctx, nok, yuridik.ID), apperr.NotFound, "not_found", notFound, "another company's type")
}

func TestAddField(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	jismoniy := mustType(t, s, olma, "Jismoniy")
	manba := mustDropdown(t, s, olma, "Manba")

	fish, err := s.AddField(ctx, olma, jismoniy.ID, FieldInput{Label: " F.I.Sh. ", Kind: "string", Required: true, Unique: true})

	require.NoError(t, err)
	assert.NotZero(t, fish.ID)
	assert.Equal(t, Field{ID: fish.ID, Label: "F.I.Sh.", Kind: "string", Required: true, Unique: true}, fish, "the name is trimmed")
	added := []Field{fish}
	for _, in := range []FieldInput{
		{Label: "Yoshi", Kind: "int"},
		{Label: "Manba", Kind: "dropdown", DropdownID: &manba.ID},
		{Label: "Kanallar", Kind: "multi_dropdown", DropdownID: &manba.ID, Required: true},
		{Label: "Holat", Kind: "radio", DropdownID: &manba.ID},
		{Label: "Qiziqish", Kind: "checkbox", DropdownID: &manba.ID},
	} {
		f, err := s.AddField(ctx, olma, jismoniy.ID, in)
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
	jismoniy := mustType(t, s, olma, "Jismoniy")
	manba := mustDropdown(t, s, olma, "Manba")
	begona := mustDropdown(t, s, nok, "Begona")
	eski := mustDropdown(t, s, olma, "Eski")
	require.NoError(t, s.DeleteDropdown(ctx, olma, eski.ID))
	_, err := s.AddField(ctx, olma, jismoniy.ID, FieldInput{Label: "F.I.Sh.", Kind: "string"})
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
		"another company's dropdown":        {FieldInput{Label: "Manba", Kind: "radio", DropdownID: &begona.ID}, apperr.Invalid, "validation_error", noDropdown},
		"a deleted dropdown":                {FieldInput{Label: "Manba", Kind: "checkbox", DropdownID: &eski.ID}, apperr.Invalid, "validation_error", noDropdown},
		"a text field with a dropdown": {FieldInput{Label: "Izoh", Kind: "string", DropdownID: &manba.ID},
			apperr.Invalid, "validation_error", "Matn va son maydoniga dropdown ulanmaydi"},
		"a choice field that may not repeat": {FieldInput{Label: "Manba", Kind: "multi_dropdown", DropdownID: &manba.ID, Unique: true},
			apperr.Invalid, "validation_error", "Faqat matn va son maydoni takrorlanmas bo'ladi"},
		"the name is taken in the type": {FieldInput{Label: "f.i.sh.", Kind: "int"}, apperr.Conflict, "name_taken", "Bu nomli maydon allaqachon bor"},
	} {
		_, err := s.AddField(ctx, olma, jismoniy.ID, tc.in)
		refused(t, err, tc.kind, tc.code, tc.message, about)
	}
	_, err = s.AddField(ctx, nok, jismoniy.ID, FieldInput{Label: "Ism", Kind: "string"})
	refused(t, err, apperr.NotFound, "not_found", "Tur topilmadi", "another company's type")

	var fields int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_fields WHERE type_id = $1", jismoniy.ID).Scan(&fields))
	assert.Equal(t, 1, fields, "a refusal adds nothing")
}
