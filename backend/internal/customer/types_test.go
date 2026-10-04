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
