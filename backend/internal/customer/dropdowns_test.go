package customer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
