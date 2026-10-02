package auth

import (
	"bytes"
	"crypto/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCode(t *testing.T) {
	t.Run("six digits", func(t *testing.T) {
		for range 100 {
			code, err := NewCode(rand.Reader)
			require.NoError(t, err)
			assert.Regexp(t, `^\d{6}$`, code)
		}
	})
	t.Run("zero padded", func(t *testing.T) {
		code, err := NewCode(bytes.NewReader(make([]byte, 64)))
		require.NoError(t, err)
		assert.Equal(t, "000000", code)
	})
}
