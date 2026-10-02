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

func TestHashCode(t *testing.T) {
	// printf '%s' 123456 | openssl dgst -sha256 -hmac test-otp-secret
	want := "4a7b809c723367f2500a1ba602464843b95f82215d47397e24058a5b8c2bd397"

	assert.Equal(t, want, HashCode([]byte("test-otp-secret"), "123456"))
}
