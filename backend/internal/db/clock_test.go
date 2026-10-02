package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCurrentDate(t *testing.T) {
	q, pool := setup(t)

	got, err := q.CurrentDate(t.Context())

	require.NoError(t, err)
	assert.True(t, got.Equal(today(t, pool)), "got %s", got)
}
