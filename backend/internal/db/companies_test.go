package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestCreateCompany(t *testing.T) {
	q, pool := setup(t)
	end := today(t, pool).AddDate(0, 0, 30)

	c := createCompany(t, q, "Olma MChJ", end)

	assert.NotZero(t, c.ID)
	assert.Equal(t, "Olma MChJ", c.Name)
	assert.True(t, c.EndDate.Equal(end), "end_date %s", c.EndDate)
	assert.True(t, c.IsActive)
	assert.Equal(t, ownerID, *c.CreatedBy)
}

func createCompany(t *testing.T, q *gen.Queries, name string, endDate time.Time) gen.Company {
	t.Helper()
	c, err := q.CreateCompany(context.Background(), gen.CreateCompanyParams{Name: name, EndDate: endDate, CreatedBy: ptr(ownerID)})
	require.NoError(t, err)
	return c
}
