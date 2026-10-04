package customer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

func TestCreateType(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma, nok := addCompany(t, pool, "Olma"), addCompany(t, pool, "Nok")

	ct, err := s.CreateType(ctx, olma, " Jismoniy ")

	require.NoError(t, err)
	assert.NotZero(t, ct.ID)
	assert.Equal(t, "Jismoniy", ct.Name, "the name is trimmed")
	assert.Equal(t, []Field{}, ct.Fields, "a new type has no fields")

	_, err = s.CreateType(ctx, olma, " ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "no name")
	_, err = s.CreateType(ctx, olma, "JISMONIY")
	refused(t, err, apperr.Conflict, "name_taken", "Bu nomli tur allaqachon bor", "the name in another case")
	_, err = s.CreateType(ctx, nok, "Jismoniy")
	assert.NoError(t, err, "another company may take the name")
	var types int
	require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM customer_types WHERE company_id = $1", olma).Scan(&types))
	assert.Equal(t, 1, types, "a refusal adds nothing")
}
