package customer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// What a customer of the company uses is not deleted; the deleted customers
// use nothing.

func TestATypeWithCustomersIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{olma.fish.ID: "Ali"})
	vali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali"})

	err := s.DeleteType(ctx, olma.id, olma.jismoniy.ID)

	refused(t, err, apperr.Conflict, "type_in_use", "Bu turda 2 ta mijoz bor")
	assert.Equal(t, []string{"Jismoniy", "Yuridik"}, typeNames(t, s, olma.id), "the type stays")
	types, err := s.Types(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, types[0].Fields, 6, "with its fields")

	assert.NoError(t, s.DeleteType(ctx, olma.id, olma.yuridik.ID), "a type with no customers")
	require.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner))
	refused(t, s.DeleteType(ctx, olma.id, olma.jismoniy.ID), apperr.Conflict, "type_in_use", "Bu turda 1 ta mijoz bor")
	require.NoError(t, s.Delete(ctx, olma.id, vali.ID, owner))
	assert.NoError(t, s.DeleteType(ctx, olma.id, olma.jismoniy.ID), "the deleted customers do not hold the type")
}

func TestAFieldCustomersFilledInIsNotDeleted(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := newShop(t, s, pool, "Olma")
	ali := mustCustomer(t, s, olma.id, olma.jismoniy.ID, aliPhone, map[int64]any{
		olma.fish.ID: "Ali", olma.yosh.ID: 30, olma.tillar.ID: []int64{olma.uzbek.ID, olma.rus.ID},
	})
	mustCustomer(t, s, olma.id, olma.jismoniy.ID, valiPhone, map[int64]any{olma.fish.ID: "Vali", olma.tillar.ID: []int64{olma.rus.ID}})

	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.fish.ID), apperr.Conflict, "field_in_use", "Bu maydon 2 ta mijozda to'ldirilgan")
	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.tillar.ID), apperr.Conflict, "field_in_use",
		"Bu maydon 2 ta mijozda to'ldirilgan", "a customer who chose two options counts once")
	refused(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID), apperr.Conflict, "field_in_use", "Bu maydon 1 ta mijozda to'ldirilgan")
	types, err := s.Types(ctx, olma.id)
	require.NoError(t, err)
	assert.Len(t, types[0].Fields, 6, "the fields stay")

	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.manba.ID), "a field nobody filled in")
	require.NoError(t, s.Delete(ctx, olma.id, ali.ID, owner))
	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.yosh.ID), "a deleted customer's answer does not hold the field")
	// An edit that empties the field frees it too.
	_, err = s.Update(ctx, olma.id, mustCustomer(t, s, olma.id, olma.jismoniy.ID, "998900000001",
		map[int64]any{olma.fish.ID: "Soli", olma.jinsi.ID: olma.erkak.ID}).ID, owner,
		Input{Phone: "998900000001", Values: answers(t, map[int64]any{olma.fish.ID: "Soli"})})
	require.NoError(t, err)
	assert.NoError(t, s.DeleteField(ctx, olma.id, olma.jismoniy.ID, olma.jinsi.ID), "an answer that was taken away does not hold it")
}
