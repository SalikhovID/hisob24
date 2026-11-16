package catalog

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

// A company's product categories (logic/products.md, 3.4): a name trimmed,
// 1–60 characters, one category's in the company whatever the case; a new
// one goes last.
func TestCreateCategory(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	drinks, err := s.CreateCategory(ctx, olma, " Ichimliklar ")
	require.NoError(t, err)
	assert.Positive(t, drinks.ID)
	assert.Equal(t, "Ichimliklar", drinks.Name, "trimmed")
	_, err = s.CreateCategory(ctx, olma, "Shirinliklar")
	require.NoError(t, err)
	_, err = s.CreateCategory(ctx, nok, "Ichimliklar")
	require.NoError(t, err, "another company has its own names")

	for name, tc := range map[string]struct {
		name    string
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":      {" ", apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a long name":  {strings.Repeat("a", 61), apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"a taken name": {"ICHIMLIKLAR", apperr.Conflict, "name_taken", "Bu nomli kategoriya allaqachon bor"},
	} {
		_, err := s.CreateCategory(ctx, olma, tc.name)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}

	list, err := s.Categories(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"Ichimliklar", "Shirinliklar"}, categoryNames(list), "the company's own, a new one last")
}
