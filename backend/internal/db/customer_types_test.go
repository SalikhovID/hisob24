package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func createType(t *testing.T, q *gen.Queries, companyID int64, name string) gen.CustomerType {
	t.Helper()
	ct, err := q.CreateCustomerType(t.Context(), gen.CreateCustomerTypeParams{CompanyID: companyID, Name: name})
	require.NoError(t, err)
	return ct
}

func TestCreateCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	first, err := q.CreateCustomerType(ctx, gen.CreateCustomerTypeParams{CompanyID: olma.ID, Name: "Jismoniy"})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, first.CompanyID)
	assert.Equal(t, "Jismoniy", first.Name)
	assert.EqualValues(t, 1, first.Position)
	assert.Nil(t, first.DeletedAt)
	assert.EqualValues(t, 2, createType(t, q, olma.ID, "Yuridik").Position, "a new type goes last")
	assert.EqualValues(t, 1, createType(t, q, nok.ID, "Jismoniy").Position, "each company orders its own")
	_, err = q.CreateCustomerType(ctx, gen.CreateCustomerTypeParams{CompanyID: olma.ID, Name: "jismoniy"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func TestListCustomerTypes(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	eski := createType(t, q, olma.ID, "Eski")
	createType(t, q, nok.ID, "Begona")
	mustExec(t, pool, "UPDATE customer_types SET position = 0 WHERE id = $1", yuridik.ID)
	mustExec(t, pool, "UPDATE customer_types SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerTypes(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{yuridik.ID, jismoniy.ID}, []int64{list[0].ID, list[1].ID}, "in their order")
}

func TestGetCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")

	ct, err := q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Jismoniy", ct.Name)

	_, err = q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
	mustExec(t, pool, "UPDATE customer_types SET deleted_at = now() WHERE id = $1", jismoniy.ID)
	_, err = q.GetCustomerType(ctx, gen.GetCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted type")
}

func TestRenameCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	createType(t, q, olma.ID, "Yuridik")

	ct, err := q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID, Name: "Shaxs"})
	require.NoError(t, err)
	assert.Equal(t, "Shaxs", ct.Name)
	assert.Equal(t, jismoniy.Position, ct.Position, "its place stays")

	_, err = q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID, Name: "yuridik"})
	assert.Equal(t, "23505", sqlState(err), "another type's name")
	_, err = q.RenameCustomerType(ctx, gen.RenameCustomerTypeParams{ID: jismoniy.ID, CompanyID: nok.ID, Name: "Begona"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
}

func TestDeleteCustomerType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")

	_, err := q.DeleteCustomerType(ctx, gen.DeleteCustomerTypeParams{ID: jismoniy.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
	id, err := q.DeleteCustomerType(ctx, gen.DeleteCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, jismoniy.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM customer_types WHERE id = $1", jismoniy.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteCustomerType(ctx, gen.DeleteCustomerTypeParams{ID: jismoniy.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func typeIDs(t *testing.T, q *gen.Queries, companyID int64) []int64 {
	t.Helper()
	list, err := q.ListCustomerTypes(t.Context(), companyID)
	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, ct := range list {
		ids = append(ids, ct.ID)
	}
	return ids
}

func TestOrderCustomerTypes(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	hamkor := createType(t, q, olma.ID, "Hamkor")
	begona := createType(t, q, nok.ID, "Begona")
	createType(t, q, nok.ID, "Ikkinchi")

	err := q.OrderCustomerTypes(t.Context(), gen.OrderCustomerTypesParams{
		CompanyID: olma.ID,
		Ids:       []int64{hamkor.ID, jismoniy.ID, yuridik.ID, begona.ID},
	})

	require.NoError(t, err)
	assert.Equal(t, []int64{hamkor.ID, jismoniy.ID, yuridik.ID}, typeIDs(t, q, olma.ID), "the types stand as the ids were given")
	assert.Equal(t, begona.ID, typeIDs(t, q, nok.ID)[0], "another company's type stays where it was")
}

// addField adds a field to the company's type; a choice kind takes its
// options from the dropdown.
func addField(t *testing.T, q *gen.Queries, companyID, typeID int64, label, kind string, dropdownID *int64) gen.CustomerField {
	t.Helper()
	f, err := q.AddCustomerField(t.Context(), gen.AddCustomerFieldParams{
		CompanyID: companyID, TypeID: typeID, Label: label, Kind: kind, DropdownID: dropdownID,
	})
	require.NoError(t, err)
	return f
}

func TestAddCustomerField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	manba := createDropdown(t, q, olma.ID, "Manba")

	f, err := q.AddCustomerField(ctx, gen.AddCustomerFieldParams{
		CompanyID: olma.ID, TypeID: jismoniy.ID, Label: "F.I.Sh.", Kind: "string", Required: true, IsUnique: true,
	})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, f.CompanyID)
	assert.Equal(t, jismoniy.ID, f.TypeID)
	assert.Equal(t, "F.I.Sh.", f.Label)
	assert.Equal(t, "string", f.Kind)
	assert.True(t, f.Required)
	assert.True(t, f.IsUnique)
	assert.Nil(t, f.DropdownID)
	assert.EqualValues(t, 1, f.Position)
	choice := addField(t, q, olma.ID, jismoniy.ID, "Manba", "dropdown", &manba.ID)
	assert.Equal(t, &manba.ID, choice.DropdownID)
	assert.False(t, choice.Required)
	assert.EqualValues(t, 2, choice.Position, "a new field goes last")

	_, err = q.AddCustomerField(ctx, gen.AddCustomerFieldParams{CompanyID: olma.ID, TypeID: jismoniy.ID, Label: "f.i.sh.", Kind: "string"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the type")
	_, err = q.AddCustomerField(ctx, gen.AddCustomerFieldParams{CompanyID: nok.ID, TypeID: jismoniy.ID, Label: "Ism", Kind: "string"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
}

func TestListCustomerFields(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	fish := addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	yosh := addField(t, q, olma.ID, jismoniy.ID, "Yoshi", "int", nil)
	eski := addField(t, q, olma.ID, jismoniy.ID, "Eski", "string", nil)
	nomi := addField(t, q, olma.ID, yuridik.ID, "Nomi", "string", nil)
	addField(t, q, nok.ID, createType(t, q, nok.ID, "Begona").ID, "Ism", "string", nil)
	mustExec(t, pool, "UPDATE customer_fields SET position = 0 WHERE id = $1", yosh.ID)
	mustExec(t, pool, "UPDATE customer_fields SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListCustomerFields(t.Context(), olma.ID)

	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, f := range list {
		ids = append(ids, f.ID)
	}
	assert.Equal(t, []int64{yosh.ID, fish.ID, nomi.ID}, ids, "each of the company's types' fields in their order, without the deleted")
}

func TestGetCustomerField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	fish := addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	its := gen.GetCustomerFieldParams{CompanyID: olma.ID, TypeID: jismoniy.ID, ID: fish.ID}

	f, err := q.GetCustomerField(ctx, its)
	require.NoError(t, err)
	assert.Equal(t, "F.I.Sh.", f.Label)

	begona := its
	begona.CompanyID = nok.ID
	_, err = q.GetCustomerField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")
	elsewhere := its
	elsewhere.TypeID = yuridik.ID
	_, err = q.GetCustomerField(ctx, elsewhere)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a field of another type")
	mustExec(t, pool, "UPDATE customer_fields SET deleted_at = now() WHERE id = $1", fish.ID)
	_, err = q.GetCustomerField(ctx, its)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted field")
}

func TestUpdateCustomerField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	fish := addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	addField(t, q, olma.ID, jismoniy.ID, "Yoshi", "int", nil)
	its := gen.UpdateCustomerFieldParams{CompanyID: olma.ID, TypeID: jismoniy.ID, ID: fish.ID}

	renamed := its
	renamed.Label = ptr("Ism")
	f, err := q.UpdateCustomerField(ctx, renamed)
	require.NoError(t, err)
	assert.Equal(t, "Ism", f.Label)
	assert.False(t, f.Required, "what is not given stays")
	assert.Equal(t, "string", f.Kind, "the kind is never changed")

	flagged := its
	flagged.Required, flagged.IsUnique = ptr(true), ptr(true)
	f, err = q.UpdateCustomerField(ctx, flagged)
	require.NoError(t, err)
	assert.True(t, f.Required)
	assert.True(t, f.IsUnique)
	assert.Equal(t, "Ism", f.Label, "what is not given stays")

	taken := its
	taken.Label = ptr("yoshi")
	_, err = q.UpdateCustomerField(ctx, taken)
	assert.Equal(t, "23505", sqlState(err), "another field's name")
	begona := renamed
	begona.CompanyID = nok.ID
	_, err = q.UpdateCustomerField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")
	mustExec(t, pool, "UPDATE customer_fields SET deleted_at = now() WHERE id = $1", fish.ID)
	_, err = q.UpdateCustomerField(ctx, renamed)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted field")
}

func TestDeleteCustomerField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	fish := addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	its := gen.DeleteCustomerFieldParams{CompanyID: olma.ID, TypeID: jismoniy.ID, ID: fish.ID}

	begona := its
	begona.CompanyID = nok.ID
	_, err := q.DeleteCustomerField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")

	id, err := q.DeleteCustomerField(ctx, its)
	require.NoError(t, err)
	assert.Equal(t, fish.ID, id)
	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM customer_fields WHERE id = $1", fish.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteCustomerField(ctx, its)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func TestDeleteCustomerTypeFields(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	addField(t, q, olma.ID, jismoniy.ID, "Yoshi", "int", nil)
	nomi := addField(t, q, olma.ID, yuridik.ID, "Nomi", "string", nil)

	require.NoError(t, q.DeleteCustomerTypeFields(ctx, jismoniy.ID))

	left, err := q.ListCustomerFields(ctx, olma.ID)
	require.NoError(t, err)
	require.Len(t, left, 1, "the type's fields are deleted, the other type's are not")
	assert.Equal(t, nomi.ID, left[0].ID)
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_fields WHERE type_id = $1", jismoniy.ID).Scan(&rows))
	assert.Equal(t, 2, rows, "the rows stay")
}

func TestOrderCustomerFields(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	jismoniy := createType(t, q, olma.ID, "Jismoniy")
	yuridik := createType(t, q, olma.ID, "Yuridik")
	fish := addField(t, q, olma.ID, jismoniy.ID, "F.I.Sh.", "string", nil)
	yosh := addField(t, q, olma.ID, jismoniy.ID, "Yoshi", "int", nil)
	izoh := addField(t, q, olma.ID, jismoniy.ID, "Izoh", "string", nil)
	nomi := addField(t, q, olma.ID, yuridik.ID, "Nomi", "string", nil)

	err := q.OrderCustomerFields(ctx, gen.OrderCustomerFieldsParams{
		TypeID: jismoniy.ID,
		Ids:    []int64{izoh.ID, fish.ID, yosh.ID, nomi.ID},
	})

	require.NoError(t, err)
	list, err := q.ListCustomerFields(ctx, olma.ID)
	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, f := range list {
		ids = append(ids, f.ID)
	}
	assert.Equal(t, []int64{izoh.ID, fish.ID, yosh.ID, nomi.ID}, ids, "the type's fields stand as the ids were given")
	assert.EqualValues(t, 1, list[3].Position, "another type's field stays where it was")
}
