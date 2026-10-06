package task

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateStage(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	st, err := s.CreateStage(ctx, olma, StageInput{Name: " Yangi ", Color: "blue"})

	require.NoError(t, err)
	assert.NotZero(t, st.ID)
	assert.Equal(t, Stage{ID: st.ID, Name: "Yangi", Color: "blue"}, st, "the name is trimmed")
	done, err := s.CreateStage(ctx, olma, StageInput{Name: "Bajarildi", Color: "green", Done: true})
	require.NoError(t, err)
	assert.True(t, done.Done, "a stage may be made for finished tasks")

	const noColor = "Rangni tanlang"
	_, err = s.CreateStage(ctx, olma, StageInput{Name: " ", Color: "blue"})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateStage(ctx, olma, StageInput{Name: "Rangsiz"})
	refused(t, err, apperr.Invalid, "validation_error", noColor, "no color")
	_, err = s.CreateStage(ctx, olma, StageInput{Name: "Oltin", Color: "gold"})
	refused(t, err, apperr.Invalid, "validation_error", noColor, "a color that is not one of the nine")
	_, err = s.CreateStage(ctx, olma, StageInput{Name: "Oltin", Color: "Blue"})
	refused(t, err, apperr.Invalid, "validation_error", noColor, "a color in another case")
	_, err = s.CreateStage(ctx, olma, StageInput{Name: "YANGI", Color: "red"})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli bosqich allaqachon bor", "the name in another case")
	_, err = s.CreateStage(ctx, nok, StageInput{Name: "Yangi", Color: "blue"})
	assert.NoError(t, err, "another company may take the name")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM task_stages WHERE company_id = $1", olma), "a refusal adds nothing")
}

func mustStage(t *testing.T, s *Service, companyID int64, name, color string) Stage {
	t.Helper()
	st, err := s.CreateStage(t.Context(), companyID, StageInput{Name: name, Color: color})
	require.NoError(t, err)
	return st
}

func TestStages(t *testing.T) {
	s, pool := newService(t)
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	yangi := mustStage(t, s, olma, "Yangi", "blue")
	jarayonda := mustStage(t, s, olma, "Jarayonda", "amber")
	bajarildi, err := s.CreateStage(t.Context(), olma, StageInput{Name: "Bajarildi", Color: "green", Done: true})
	require.NoError(t, err)
	mustStage(t, s, nok, "Begona", "blue")

	list, err := s.Stages(t.Context(), olma)

	require.NoError(t, err)
	assert.Equal(t, []Stage{
		{ID: yangi.ID, Name: "Yangi", Color: "blue"},
		{ID: jarayonda.ID, Name: "Jarayonda", Color: "amber"},
		{ID: bajarildi.ID, Name: "Bajarildi", Color: "green", Done: true},
	}, list, "the company's stages in their order")
	none, err := s.Stages(t.Context(), addCompany(t, pool, "Anor"))
	require.NoError(t, err)
	assert.Equal(t, []Stage{}, none, "a company with no stages lists none, not nil")
}

func TestUpdateStage(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	yangi := mustStage(t, s, olma, "Yangi", "blue")
	mustStage(t, s, olma, "Jarayonda", "amber")

	st, err := s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Name: ptr(" Ochiq ")})
	require.NoError(t, err)
	assert.Equal(t, Stage{ID: yangi.ID, Name: "Ochiq", Color: "blue"}, st, "the name is trimmed; what is not given stays")
	st, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Color: ptr("teal")})
	require.NoError(t, err)
	assert.Equal(t, Stage{ID: yangi.ID, Name: "Ochiq", Color: "teal"}, st)
	st, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Done: ptr(true)})
	require.NoError(t, err)
	assert.Equal(t, Stage{ID: yangi.ID, Name: "Ochiq", Color: "teal", Done: true}, st)
	st, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{})
	require.NoError(t, err)
	assert.Equal(t, Stage{ID: yangi.ID, Name: "Ochiq", Color: "teal", Done: true}, st, "nothing given changes nothing")

	const notFound = "Bosqich topilmadi"
	_, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Name: ptr(" ")})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Color: ptr("gold")})
	refused(t, err, apperr.Invalid, "validation_error", "Rangni tanlang", "a color that is not one of the nine")
	_, err = s.UpdateStage(ctx, olma, yangi.ID, StagePatch{Name: ptr("JARAYONDA")})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli bosqich allaqachon bor", "another stage's name")
	_, err = s.UpdateStage(ctx, nok, yangi.ID, StagePatch{Name: ptr("Begona")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "another company's stage")
	_, err = s.UpdateStage(ctx, olma, yangi.ID+100, StagePatch{Name: ptr("Yo'q")})
	refused(t, err, apperr.NotFound, "not_found", notFound, "no such stage")
}

func stageNames(t *testing.T, s *Service, companyID int64) []string {
	t.Helper()
	list, err := s.Stages(t.Context(), companyID)
	require.NoError(t, err)
	names := []string{}
	for _, st := range list {
		names = append(names, st.Name)
	}
	return names
}

func TestDeleteStage(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	yangi := mustStage(t, s, olma, "Yangi", "blue")
	mustStage(t, s, olma, "Jarayonda", "amber")

	require.NoError(t, s.DeleteStage(ctx, olma, yangi.ID))

	assert.Equal(t, []string{"Jarayonda"}, stageNames(t, s, olma), "the stage is gone from the company's")
	assert.Equal(t, 2, count(t, pool, "SELECT count(*) FROM task_stages WHERE company_id = $1", olma), "nothing leaves the database")
	again := mustStage(t, s, olma, "Yangi", "blue")
	assert.NotEqual(t, yangi.ID, again.ID, "the deleted stage's name is free again")

	const notFound = "Bosqich topilmadi"
	refused(t, s.DeleteStage(ctx, olma, yangi.ID), apperr.NotFound, "not_found", notFound, "deleted already")
	refused(t, s.DeleteStage(ctx, nok, again.ID), apperr.NotFound, "not_found", notFound, "another company's stage")
}

func TestOrderStages(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	yangi := mustStage(t, s, olma, "Yangi", "blue")
	jarayonda := mustStage(t, s, olma, "Jarayonda", "amber")
	bajarildi := mustStage(t, s, olma, "Bajarildi", "green")
	begona := mustStage(t, s, nok, "Begona", "blue")

	require.NoError(t, s.OrderStages(ctx, olma, []int64{bajarildi.ID, yangi.ID, jarayonda.ID}))

	assert.Equal(t, []string{"Bajarildi", "Yangi", "Jarayonda"}, stageNames(t, s, olma))

	const changed = "Ro'yxat o'zgargan. Sahifani yangilang"
	for about, ids := range map[string][]int64{
		"a stage is missing":         {yangi.ID, jarayonda.ID},
		"another company's stage":    {yangi.ID, jarayonda.ID, begona.ID},
		"a stage named twice":        {yangi.ID, yangi.ID, jarayonda.ID},
		"more stages than there are": {yangi.ID, jarayonda.ID, bajarildi.ID, begona.ID},
		"nothing at all":             {},
	} {
		refused(t, s.OrderStages(ctx, olma, ids), apperr.Conflict, "order_changed", changed, about)
	}
	assert.Equal(t, []string{"Bajarildi", "Yangi", "Jarayonda"}, stageNames(t, s, olma), "a refusal moves nothing")

	mustStage(t, s, olma, "Yangi bosqich", "pink")
	assert.Equal(t, []string{"Bajarildi", "Yangi", "Jarayonda", "Yangi bosqich"}, stageNames(t, s, olma), "a new stage still goes last")
}
