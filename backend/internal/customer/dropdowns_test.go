package customer

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateDropdown(t *testing.T) {
	s, pool := newService(t)
	olma := addCompany(t, pool, "Olma")

	d, err := s.CreateDropdown(t.Context(), olma, "  Manba ")

	require.NoError(t, err)
	assert.NotZero(t, d.ID)
	assert.Equal(t, "Manba", d.Name, "the name is trimmed")
	assert.Equal(t, []Option{}, d.Options, "a new dropdown has no options")
	var company int64
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT company_id FROM customer_dropdowns WHERE id = $1", d.ID).Scan(&company))
	assert.Equal(t, olma, company)
}

func TestCreateDropdownRefusals(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")
	_, err := s.CreateDropdown(ctx, olma, "Manba")
	require.NoError(t, err)

	_, err = s.CreateDropdown(ctx, olma, "   ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateDropdown(ctx, olma, strings.Repeat("ў", 61))
	refused(t, err, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin", "a name too long")
	_, err = s.CreateDropdown(ctx, olma, strings.Repeat("ў", 60))
	assert.NoError(t, err, "sixty characters, counted as characters and not as bytes")
	_, err = s.CreateDropdown(ctx, olma, " MANBA ")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli dropdown allaqachon bor", "the name in another case")
	_, err = s.CreateDropdown(ctx, nok, "Manba")
	assert.NoError(t, err, "another company may take the name")

	var dropdowns int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_dropdowns WHERE company_id = $1", olma).Scan(&dropdowns))
	assert.Equal(t, 2, dropdowns, "a refusal adds nothing")
}
