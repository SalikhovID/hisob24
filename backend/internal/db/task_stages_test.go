package db_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func createStage(t *testing.T, q *gen.Queries, companyID int64, name, color string) gen.TaskStage {
	t.Helper()
	st, err := q.CreateTaskStage(t.Context(), gen.CreateTaskStageParams{CompanyID: companyID, Name: name, Color: color})
	require.NoError(t, err)
	return st
}

func TestCreateTaskStage(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))

	first, err := q.CreateTaskStage(ctx, gen.CreateTaskStageParams{CompanyID: olma.ID, Name: "Yangi", Color: "blue"})

	require.NoError(t, err)
	assert.Equal(t, olma.ID, first.CompanyID)
	assert.Equal(t, "Yangi", first.Name)
	assert.Equal(t, "blue", first.Color)
	assert.False(t, first.IsDone)
	assert.EqualValues(t, 1, first.Position)
	assert.Nil(t, first.DeletedAt)
	assert.EqualValues(t, 2, createStage(t, q, olma.ID, "Jarayonda", "amber").Position, "a new stage goes last")
	assert.EqualValues(t, 1, createStage(t, q, nok.ID, "Yangi", "blue").Position, "each company orders its own")
	done, err := q.CreateTaskStage(ctx, gen.CreateTaskStageParams{CompanyID: olma.ID, Name: "Bajarildi", Color: "green", IsDone: true})
	require.NoError(t, err)
	assert.True(t, done.IsDone, "a stage may be made for finished tasks")
	_, err = q.CreateTaskStage(ctx, gen.CreateTaskStageParams{CompanyID: olma.ID, Name: "yangi", Color: "red"})
	assert.Equal(t, "23505", sqlState(err), "the name is taken in the company") // unique_violation
}

func TestListTaskStages(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	yangi := createStage(t, q, olma.ID, "Yangi", "blue")
	bajarildi := createStage(t, q, olma.ID, "Bajarildi", "green")
	eski := createStage(t, q, olma.ID, "Eski", "slate")
	createStage(t, q, nok.ID, "Begona", "blue")
	mustExec(t, pool, "UPDATE task_stages SET position = 0 WHERE id = $1", bajarildi.ID)
	mustExec(t, pool, "UPDATE task_stages SET deleted_at = now() WHERE id = $1", eski.ID)

	list, err := q.ListTaskStages(t.Context(), olma.ID)

	require.NoError(t, err)
	require.Len(t, list, 2, "the company's own, without the deleted one")
	assert.Equal(t, []int64{bajarildi.ID, yangi.ID}, []int64{list[0].ID, list[1].ID}, "in their order")
}

func TestGetTaskStage(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	yangi := createStage(t, q, olma.ID, "Yangi", "blue")

	st, err := q.GetTaskStage(ctx, gen.GetTaskStageParams{ID: yangi.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, "Yangi", st.Name)

	_, err = q.GetTaskStage(ctx, gen.GetTaskStageParams{ID: yangi.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's stage")
	mustExec(t, pool, "UPDATE task_stages SET deleted_at = now() WHERE id = $1", yangi.ID)
	_, err = q.GetTaskStage(ctx, gen.GetTaskStageParams{ID: yangi.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted stage")
}

func TestUpdateTaskStage(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	yangi := createStage(t, q, olma.ID, "Yangi", "blue")
	createStage(t, q, olma.ID, "Jarayonda", "amber")
	its := gen.UpdateTaskStageParams{ID: yangi.ID, CompanyID: olma.ID}

	renamed := its
	renamed.Name = ptr("Ochiq")
	st, err := q.UpdateTaskStage(ctx, renamed)
	require.NoError(t, err)
	assert.Equal(t, "Ochiq", st.Name)
	assert.Equal(t, "blue", st.Color, "what is not given stays")
	assert.False(t, st.IsDone, "what is not given stays")
	assert.Equal(t, yangi.Position, st.Position, "its place stays")

	recolored := its
	recolored.Color = ptr("teal")
	st, err = q.UpdateTaskStage(ctx, recolored)
	require.NoError(t, err)
	assert.Equal(t, "teal", st.Color)
	assert.Equal(t, "Ochiq", st.Name, "what is not given stays")

	finished := its
	finished.IsDone = ptr(true)
	st, err = q.UpdateTaskStage(ctx, finished)
	require.NoError(t, err)
	assert.True(t, st.IsDone)
	assert.Equal(t, "teal", st.Color, "what is not given stays")
	st, err = q.UpdateTaskStage(ctx, its)
	require.NoError(t, err)
	assert.True(t, st.IsDone, "nothing given changes nothing")

	taken := its
	taken.Name = ptr("jarayonda")
	_, err = q.UpdateTaskStage(ctx, taken)
	assert.Equal(t, "23505", sqlState(err), "another stage's name")
	begona := renamed
	begona.CompanyID = nok.ID
	_, err = q.UpdateTaskStage(ctx, begona)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's stage")
	mustExec(t, pool, "UPDATE task_stages SET deleted_at = now() WHERE id = $1", yangi.ID)
	_, err = q.UpdateTaskStage(ctx, renamed)
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a deleted stage")
}

func TestDeleteTaskStage(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	yangi := createStage(t, q, olma.ID, "Yangi", "blue")

	_, err := q.DeleteTaskStage(ctx, gen.DeleteTaskStageParams{ID: yangi.ID, CompanyID: nok.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "another company's stage")
	id, err := q.DeleteTaskStage(ctx, gen.DeleteTaskStageParams{ID: yangi.ID, CompanyID: olma.ID})
	require.NoError(t, err)
	assert.Equal(t, yangi.ID, id)

	var hidden bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM task_stages WHERE id = $1", yangi.ID).Scan(&hidden))
	assert.True(t, hidden, "the row stays, marked deleted")
	_, err = q.DeleteTaskStage(ctx, gen.DeleteTaskStageParams{ID: yangi.ID, CompanyID: olma.ID})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "deleted already")
}

func stageIDs(t *testing.T, q *gen.Queries, companyID int64) []int64 {
	t.Helper()
	list, err := q.ListTaskStages(t.Context(), companyID)
	require.NoError(t, err)
	ids := make([]int64, 0, len(list))
	for _, st := range list {
		ids = append(ids, st.ID)
	}
	return ids
}

func TestOrderTaskStages(t *testing.T) {
	q, pool := setup(t)
	olma := createCompany(t, q, "Olma", today(t, pool))
	nok := createCompany(t, q, "Nok", today(t, pool))
	yangi := createStage(t, q, olma.ID, "Yangi", "blue")
	jarayonda := createStage(t, q, olma.ID, "Jarayonda", "amber")
	bajarildi := createStage(t, q, olma.ID, "Bajarildi", "green")
	begona := createStage(t, q, nok.ID, "Begona", "blue")
	createStage(t, q, nok.ID, "Ikkinchi", "red")

	err := q.OrderTaskStages(t.Context(), gen.OrderTaskStagesParams{
		CompanyID: olma.ID,
		Ids:       []int64{bajarildi.ID, yangi.ID, jarayonda.ID, begona.ID},
	})

	require.NoError(t, err)
	assert.Equal(t, []int64{bajarildi.ID, yangi.ID, jarayonda.ID}, stageIDs(t, q, olma.ID), "the stages stand as the ids were given")
	assert.Equal(t, begona.ID, stageIDs(t, q, nok.ID)[0], "another company's stage stays where it was")
}
