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
