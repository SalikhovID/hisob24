package finance

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// categoryNames is the names of the categories, in order.
func categoryNames(list []Category) []string {
	names := []string{}
	for _, c := range list {
		names = append(names, c.Name)
	}
	return names
}

func TestCategories(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	ijara, err := s.CreateCategory(ctx, olma, CategoryInput{Name: " Ijara ", Kind: "expense"})
	require.NoError(t, err)
	assert.Positive(t, ijara.ID)
	assert.Equal(t, "Ijara", ijara.Name, "trimmed")
	assert.Equal(t, "expense", ijara.Kind)
	assert.True(t, ijara.Active)
	kommunal, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Kommunal", Kind: "expense"})
	require.NoError(t, err)
	boshqa, err := s.CreateCategory(ctx, olma, CategoryInput{Name: "Boshqa kirim", Kind: "income"})
	require.NoError(t, err)
	_, err = s.CreateCategory(ctx, nok, CategoryInput{Name: "Ijara", Kind: "expense"})
	require.NoError(t, err, "another company has its own names")
	_, err = s.CreateCategory(ctx, olma, CategoryInput{Name: "Ijara", Kind: "income"})
	require.NoError(t, err, "the other kind may have the name")

	for name, tc := range map[string]struct {
		in      CategoryInput
		kind    apperr.Kind
		code    string
		message string
	}{
		"no kind":      {CategoryInput{Name: "Soliq"}, apperr.Invalid, "validation_error", "Turni tanlang"},
		"a wrong kind": {CategoryInput{Name: "Soliq", Kind: "transfer"}, apperr.Invalid, "validation_error", "Turni tanlang"},
		"no name":      {CategoryInput{Name: " ", Kind: "expense"}, apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a long name":  {CategoryInput{Name: strings.Repeat("a", 61), Kind: "expense"}, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"a taken name": {CategoryInput{Name: "ijara", Kind: "expense"}, apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor"},
	} {
		_, err := s.CreateCategory(ctx, olma, tc.in)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}

	all, err := s.Categories(ctx, olma, "")
	require.NoError(t, err)
	assert.Equal(t, []string{"Ijara", "Kommunal", "Boshqa kirim", "Ijara"}, categoryNames(all), "the expenses first, each kind in its order")
	expenses, err := s.Categories(ctx, olma, "expense")
	require.NoError(t, err)
	assert.Equal(t, []string{"Ijara", "Kommunal"}, categoryNames(expenses))
	_, err = s.Categories(ctx, olma, "transfer")
	refused(t, err, apperr.Invalid, "validation_error", "Tur noto'g'ri")

	renamed, err := s.UpdateCategory(ctx, olma, ijara.ID, CategoryPatch{Name: ptr(" Ofis ijarasi ")})
	require.NoError(t, err)
	assert.Equal(t, "Ofis ijarasi", renamed.Name)
	assert.True(t, renamed.Active, "what is not given stays")
	off, err := s.UpdateCategory(ctx, olma, ijara.ID, CategoryPatch{Active: ptr(false)})
	require.NoError(t, err)
	assert.False(t, off.Active)
	assert.Equal(t, "Ofis ijarasi", off.Name)
	_, err = s.UpdateCategory(ctx, olma, ijara.ID, CategoryPatch{Name: ptr("KOMMUNAL")})
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor")
	_, err = s.UpdateCategory(ctx, olma, ijara.ID, CategoryPatch{Name: ptr(" ")})
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting")
	_, err = s.UpdateCategory(ctx, nok, ijara.ID, CategoryPatch{Name: ptr("Soliq")})
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "another company's")

	require.NoError(t, s.OrderCategories(ctx, olma, "expense", []int64{kommunal.ID, ijara.ID}))
	expenses, err = s.Categories(ctx, olma, "expense")
	require.NoError(t, err)
	assert.Equal(t, []string{"Kommunal", "Ofis ijarasi"}, categoryNames(expenses))
	err = s.OrderCategories(ctx, olma, "expense", []int64{kommunal.ID, ijara.ID, boshqa.ID})
	refused(t, err, apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang", "an order has to name the kind's categories and nothing else")
	err = s.OrderCategories(ctx, olma, "transfer", []int64{kommunal.ID})
	refused(t, err, apperr.Invalid, "validation_error", "Tur noto'g'ri")

	require.NoError(t, s.DeleteCategory(ctx, olma, kommunal.ID))
	err = s.DeleteCategory(ctx, olma, kommunal.ID)
	refused(t, err, apperr.NotFound, "not_found", "Kategoriya topilmadi", "deleted already")
	expenses, err = s.Categories(ctx, olma, "expense")
	require.NoError(t, err)
	assert.Equal(t, []string{"Ofis ijarasi"}, categoryNames(expenses))
	_, err = s.CreateCategory(ctx, olma, CategoryInput{Name: "Kommunal", Kind: "expense"})
	require.NoError(t, err, "a deleted category's name is free again")
}
