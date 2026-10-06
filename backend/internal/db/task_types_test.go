package db_test

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func createTaskType(t *testing.T, q *gen.Queries, companyID int64, name string) gen.TaskType {
	t.Helper()
	tt, err := q.CreateTaskType(t.Context(), gen.CreateTaskTypeParams{CompanyID: companyID, Name: name})
	require.NoError(t, err)
	return tt
}

func TestCreateTaskType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	first, err := q.CreateTaskType(ctx, gen.CreateTaskTypeParams{CompanyID: olma.ID, Name: "Buyurtma"})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, first.CompanyID)
	assert.Equal(t, "Buyurtma", first.Name)
	assert.EqualValues(t, 1, first.Position)
	assert.Nil(t, first.DeletedAt)
	assert.EqualValues(t, 2, createTaskType(t, q, olma.ID, "Shikoyat").Position, "a new type goes last")
	assert.EqualValues(t, 1, createTaskType(t, q, nok.ID, "Buyurtma").Position, "each company orders its own")
	_, err = q.CreateTaskType(ctx, gen.CreateTaskTypeParams{CompanyID: olma.ID, Name: "buyurtma"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func TestListTaskTypes(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	eski := createTaskType(t, q, olma.ID, "Eski")
	createTaskType(t, q, nok.ID, "Begona")
	mustExec(t, pool, "UPDATE task_types SET position = 0 WHERE id = $1", shikoyat.ID)
	mustExec(t, pool, "UPDATE task_types SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListTaskTypes(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{shikoyat.ID, buyurtma.ID}, []int64{list[0].ID, list[1].ID}, "in their order")
}

func TestGetTaskType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")

	tt, err := q.GetTaskType(ctx, gen.GetTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Buyurtma", tt.Name)

	_, err = q.GetTaskType(ctx, gen.GetTaskTypeParams{ID: buyurtma.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
	mustExec(t, pool, "UPDATE task_types SET deleted_at = now() WHERE id = $1", buyurtma.ID)
	_, err = q.GetTaskType(ctx, gen.GetTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted type")
}

func TestRenameTaskType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	createTaskType(t, q, olma.ID, "Shikoyat")

	tt, err := q.RenameTaskType(ctx, gen.RenameTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID, Name: "Zakaz"})
	require.NoError(t, err)
	assert.Equal(t, "Zakaz", tt.Name)
	assert.Equal(t, buyurtma.Position, tt.Position, "its place stays")

	_, err = q.RenameTaskType(ctx, gen.RenameTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID, Name: "shikoyat"})
	assert.Equal(t, "23505", sqlState(err), "another type's name")
	_, err = q.RenameTaskType(ctx, gen.RenameTaskTypeParams{ID: buyurtma.ID, CompanyID: nok.ID, Name: "Begona"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
}

func TestDeleteTaskType(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")

	_, err := q.DeleteTaskType(ctx, gen.DeleteTaskTypeParams{ID: buyurtma.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
	id, err := q.DeleteTaskType(ctx, gen.DeleteTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, buyurtma.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM task_types WHERE id = $1", buyurtma.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteTaskType(ctx, gen.DeleteTaskTypeParams{ID: buyurtma.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func taskTypeIDs(t *testing.T, q *gen.Queries, companyID int64) []int64 {
	t.Helper()
	list, err := q.ListTaskTypes(t.Context(), companyID)
	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, tt := range list {
		ids = append(ids, tt.ID)
	}
	return ids
}

func TestOrderTaskTypes(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	qongiroq := createTaskType(t, q, olma.ID, "Qo'ng'iroq")
	begona := createTaskType(t, q, nok.ID, "Begona")
	createTaskType(t, q, nok.ID, "Ikkinchi")

	err := q.OrderTaskTypes(t.Context(), gen.OrderTaskTypesParams{
		CompanyID: olma.ID,
		Ids:       []int64{qongiroq.ID, buyurtma.ID, shikoyat.ID, begona.ID},
	})

	require.NoError(t, err)
	assert.Equal(t, []int64{qongiroq.ID, buyurtma.ID, shikoyat.ID}, taskTypeIDs(t, q, olma.ID), "the types stand as the ids were given")
	assert.Equal(t, begona.ID, taskTypeIDs(t, q, nok.ID)[0], "another company's type stays where it was")
}

// addTaskField adds a field to the company's task type; a choice kind takes
// its options from the dropdown.
func addTaskField(t *testing.T, q *gen.Queries, companyID, typeID int64, label, kind string, dropdownID *int64) gen.TaskField {
	t.Helper()
	f, err := q.AddTaskField(t.Context(), gen.AddTaskFieldParams{
		CompanyID: companyID, TypeID: typeID, Label: label, Kind: kind, DropdownID: dropdownID,
	})
	require.NoError(t, err)
	return f
}

func TestAddTaskField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	manba := createDropdown(t, q, olma.ID, "Manba")

	f, err := q.AddTaskField(ctx, gen.AddTaskFieldParams{
		CompanyID: olma.ID, TypeID: buyurtma.ID, Label: "Izoh", Kind: "string", Required: true,
	})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, f.CompanyID)
	assert.Equal(t, buyurtma.ID, f.TypeID)
	assert.Equal(t, "Izoh", f.Label)
	assert.Equal(t, "string", f.Kind)
	assert.True(t, f.Required)
	assert.Nil(t, f.DropdownID)
	assert.EqualValues(t, 1, f.Position)
	choice := addTaskField(t, q, olma.ID, buyurtma.ID, "Manba", "dropdown", &manba.ID)
	assert.Equal(t, &manba.ID, choice.DropdownID)
	assert.False(t, choice.Required)
	assert.EqualValues(t, 2, choice.Position, "a new field goes last")

	_, err = q.AddTaskField(ctx, gen.AddTaskFieldParams{CompanyID: olma.ID, TypeID: buyurtma.ID, Label: "izoh", Kind: "string"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the type")
	_, err = q.AddTaskField(ctx, gen.AddTaskFieldParams{CompanyID: nok.ID, TypeID: buyurtma.ID, Label: "Summa", Kind: "int"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's type")
}

func TestListTaskFields(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	izoh := addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	summa := addTaskField(t, q, olma.ID, buyurtma.ID, "Summa", "int", nil)
	eski := addTaskField(t, q, olma.ID, buyurtma.ID, "Eski", "string", nil)
	sabab := addTaskField(t, q, olma.ID, shikoyat.ID, "Sabab", "string", nil)
	addTaskField(t, q, nok.ID, createTaskType(t, q, nok.ID, "Begona").ID, "Izoh", "string", nil)
	mustExec(t, pool, "UPDATE task_fields SET position = 0 WHERE id = $1", summa.ID)
	mustExec(t, pool, "UPDATE task_fields SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListTaskFields(t.Context(), olma.ID)

	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, f := range list {
		ids = append(ids, f.ID)
	}
	assert.Equal(t, []int64{summa.ID, izoh.ID, sabab.ID}, ids, "each of the company's types' fields in their order, without the deleted")
}

func TestGetTaskField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	izoh := addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	its := gen.GetTaskFieldParams{CompanyID: olma.ID, TypeID: buyurtma.ID, ID: izoh.ID}

	f, err := q.GetTaskField(ctx, its)
	require.NoError(t, err)
	assert.Equal(t, "Izoh", f.Label)

	begona := its
	begona.CompanyID = nok.ID
	_, err = q.GetTaskField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")
	elsewhere := its
	elsewhere.TypeID = shikoyat.ID
	_, err = q.GetTaskField(ctx, elsewhere)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a field of another type")
	mustExec(t, pool, "UPDATE task_fields SET deleted_at = now() WHERE id = $1", izoh.ID)
	_, err = q.GetTaskField(ctx, its)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted field")
}

func TestUpdateTaskField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	izoh := addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	addTaskField(t, q, olma.ID, buyurtma.ID, "Summa", "int", nil)
	its := gen.UpdateTaskFieldParams{CompanyID: olma.ID, TypeID: buyurtma.ID, ID: izoh.ID}

	renamed := its
	renamed.Label = ptr("Tavsif")
	f, err := q.UpdateTaskField(ctx, renamed)
	require.NoError(t, err)
	assert.Equal(t, "Tavsif", f.Label)
	assert.False(t, f.Required, "what is not given stays")
	assert.Equal(t, "string", f.Kind, "the kind is never changed")

	flagged := its
	flagged.Required = ptr(true)
	f, err = q.UpdateTaskField(ctx, flagged)
	require.NoError(t, err)
	assert.True(t, f.Required)
	assert.Equal(t, "Tavsif", f.Label, "what is not given stays")

	taken := its
	taken.Label = ptr("summa")
	_, err = q.UpdateTaskField(ctx, taken)
	assert.Equal(t, "23505", sqlState(err), "another field's name")
	begona := renamed
	begona.CompanyID = nok.ID
	_, err = q.UpdateTaskField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")
	mustExec(t, pool, "UPDATE task_fields SET deleted_at = now() WHERE id = $1", izoh.ID)
	_, err = q.UpdateTaskField(ctx, renamed)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted field")
}

func TestDeleteTaskField(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	izoh := addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	its := gen.DeleteTaskFieldParams{CompanyID: olma.ID, TypeID: buyurtma.ID, ID: izoh.ID}

	begona := its
	begona.CompanyID = nok.ID
	_, err := q.DeleteTaskField(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's field")

	id, err := q.DeleteTaskField(ctx, its)
	require.NoError(t, err)
	assert.Equal(t, izoh.ID, id)
	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM task_fields WHERE id = $1", izoh.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteTaskField(ctx, its)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func TestDeleteTaskTypeFields(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	addTaskField(t, q, olma.ID, buyurtma.ID, "Summa", "int", nil)
	sabab := addTaskField(t, q, olma.ID, shikoyat.ID, "Sabab", "string", nil)

	require.NoError(t, q.DeleteTaskTypeFields(ctx, buyurtma.ID))

	left, err := q.ListTaskFields(ctx, olma.ID)
	require.NoError(t, err)
	require.Len(t, left, 1, "the type's fields are deleted, the other type's are not")
	assert.Equal(t, sabab.ID, left[0].ID)
	var rows int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM task_fields WHERE type_id = $1", buyurtma.ID).Scan(&rows))
	assert.Equal(t, 2, rows, "the rows stay")
}

func TestOrderTaskFields(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	buyurtma := createTaskType(t, q, olma.ID, "Buyurtma")
	shikoyat := createTaskType(t, q, olma.ID, "Shikoyat")
	izoh := addTaskField(t, q, olma.ID, buyurtma.ID, "Izoh", "string", nil)
	summa := addTaskField(t, q, olma.ID, buyurtma.ID, "Summa", "int", nil)
	manzil := addTaskField(t, q, olma.ID, buyurtma.ID, "Manzil", "string", nil)
	sabab := addTaskField(t, q, olma.ID, shikoyat.ID, "Sabab", "string", nil)

	err := q.OrderTaskFields(ctx, gen.OrderTaskFieldsParams{
		TypeID: buyurtma.ID,
		Ids:    []int64{manzil.ID, izoh.ID, summa.ID, sabab.ID},
	})

	require.NoError(t, err)
	list, err := q.ListTaskFields(ctx, olma.ID)
	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, f := range list {
		ids = append(ids, f.ID)
	}
	assert.Equal(t, []int64{manzil.ID, izoh.ID, summa.ID, sabab.ID}, ids, "the type's fields stand as the ids were given")
	assert.EqualValues(t, 1, list[3].Position, "another type's field stays where it was")
}

func TestSeedTaskSettings(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	require.NoError(t, q.SeedTaskSettings(ctx, olma.ID))

	stages, err := q.ListTaskStages(ctx, olma.ID)
	require.NoError(t, err)
	described := make([]string, 0, len(stages))
	for _, st := range stages {
		described = append(described, fmt.Sprintf("%s %s done=%t", st.Name, st.Color, st.IsDone))
	}
	assert.Equal(t, []string{"Yangi blue done=false", "Jarayonda amber done=false", "Bajarildi green done=true"}, described, "in this order")
	types, err := q.ListTaskTypes(ctx, olma.ID)
	require.NoError(t, err)
	require.Len(t, types, 1)
	assert.Equal(t, "Vazifa", types[0].Name)
	fields, err := q.ListTaskFields(ctx, olma.ID)
	require.NoError(t, err)
	assert.Empty(t, fields, "the ready type has no fields")
	none, err := q.ListTaskStages(ctx, nok.ID)
	require.NoError(t, err)
	assert.Empty(t, none, "another company gets nothing")
}
