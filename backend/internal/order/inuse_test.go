package order

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// What an order of the company uses is not deleted; the deleted orders use
// nothing.

func TestAStageWithOrdersIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	first := mustOrder(t, s, sh, "2026-10-10", map[int64]any{sh.izoh.ID: "X"})
	second := mustOrder(t, s, sh, "2026-10-11", map[int64]any{sh.izoh.ID: "X"})
	gone := mustOrder(t, s, sh, "2026-10-12", map[int64]any{sh.izoh.ID: "X"})
	require.NoError(t, s.Delete(ctx, sh.scope(), gone.ID, owner))

	err := s.DeleteStage(ctx, sh.id, sh.yangi.ID)

	refused(t, err, apperr.Conflict, "stage_in_use", "Bu bosqichda 2 ta buyurtma bor")
	stages, err := s.Stages(ctx, sh.id)
	require.NoError(t, err)
	assert.Len(t, stages, 3, "the stage stays")

	assert.NoError(t, s.DeleteStage(ctx, sh.id, sh.bajarildi.ID), "a stage with no orders")
	_, err = s.Move(ctx, sh.scope(), first.ID, owner, sh.jarayonda.ID)
	require.NoError(t, err)
	refused(t, s.DeleteStage(ctx, sh.id, sh.yangi.ID), apperr.Conflict, "stage_in_use", "Bu bosqichda 1 ta buyurtma bor",
		"an order moved away does not hold the stage")
	require.NoError(t, s.Delete(ctx, sh.scope(), second.ID, owner))
	assert.NoError(t, s.DeleteStage(ctx, sh.id, sh.yangi.ID), "the deleted orders do not hold the stage")
}

func TestATypeWithOrdersIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	first := mustOrder(t, s, sh, "2026-10-10", map[int64]any{sh.izoh.ID: "X"})
	second := mustOrder(t, s, sh, "2026-10-11", map[int64]any{sh.izoh.ID: "X"})
	shikoyat := mustType(t, s, sh.id, "Shikoyat")

	err := s.DeleteType(ctx, sh.id, sh.buyurtma.ID)

	refused(t, err, apperr.Conflict, "type_in_use", "Bu turda 2 ta buyurtma bor")
	types, err := s.Types(ctx, sh.id)
	require.NoError(t, err)
	require.Len(t, types, 2, "the type stays")
	assert.Len(t, types[0].Fields, 3, "with its fields")

	assert.NoError(t, s.DeleteType(ctx, sh.id, shikoyat.ID), "a type with no orders")
	require.NoError(t, s.Delete(ctx, sh.scope(), first.ID, owner))
	refused(t, s.DeleteType(ctx, sh.id, sh.buyurtma.ID), apperr.Conflict, "type_in_use", "Bu turda 1 ta buyurtma bor")
	require.NoError(t, s.Delete(ctx, sh.scope(), second.ID, owner))
	assert.NoError(t, s.DeleteType(ctx, sh.id, sh.buyurtma.ID), "the deleted orders do not hold the type")
}

func TestAFieldOrdersFilledInIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	sh := newShop(t, s, pool, "Olma")
	manzil := mustField(t, s, sh.id, sh.buyurtma.ID, FieldInput{Label: "Manzil", Kind: "string"})
	first := mustOrder(t, s, sh, "2026-10-10", map[int64]any{
		sh.izoh.ID: "X", sh.summa.ID: 45000, sh.kanal.ID: []int64{sh.instagram.ID, sh.linkedin.ID},
	})
	mustOrder(t, s, sh, "2026-10-11", map[int64]any{sh.izoh.ID: "X", sh.kanal.ID: []int64{sh.linkedin.ID}})
	gone := mustOrder(t, s, sh, "2026-10-12", map[int64]any{sh.izoh.ID: "X", sh.summa.ID: 1})
	require.NoError(t, s.Delete(ctx, sh.scope(), gone.ID, owner))

	refused(t, s.DeleteField(ctx, sh.id, sh.buyurtma.ID, sh.izoh.ID), apperr.Conflict, "field_in_use", "Bu maydon 2 ta buyurtmada to'ldirilgan")
	refused(t, s.DeleteField(ctx, sh.id, sh.buyurtma.ID, sh.kanal.ID), apperr.Conflict, "field_in_use",
		"Bu maydon 2 ta buyurtmada to'ldirilgan", "an order that chose two options counts once")
	refused(t, s.DeleteField(ctx, sh.id, sh.buyurtma.ID, sh.summa.ID), apperr.Conflict, "field_in_use",
		"Bu maydon 1 ta buyurtmada to'ldirilgan", "a deleted order's answer does not hold the field")
	types, err := s.Types(ctx, sh.id)
	require.NoError(t, err)
	assert.Len(t, types[0].Fields, 4, "the fields stay")

	assert.NoError(t, s.DeleteField(ctx, sh.id, sh.buyurtma.ID, manzil.ID), "a field nobody filled in")
	// An edit that empties the field frees it.
	_, err = s.Update(ctx, sh.scope(), first.ID, owner, Input{
		Deadline: "2026-10-10", StageID: sh.yangi.ID,
		Values: answers(t, map[int64]any{sh.izoh.ID: "X", sh.kanal.ID: []int64{sh.instagram.ID}}),
	})
	require.NoError(t, err)
	assert.NoError(t, s.DeleteField(ctx, sh.id, sh.buyurtma.ID, sh.summa.ID), "an answer that was taken away does not hold it")
}
