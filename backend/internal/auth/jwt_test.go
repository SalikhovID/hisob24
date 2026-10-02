package auth

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var jwtSecret = []byte("test-jwt-secret")

// payloadOf decodes a token's claims without checking it.
func payloadOf(t *testing.T, token string) map[string]any {
	t.Helper()
	parts := strings.Split(token, ".")
	require.Len(t, parts, 3)
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	require.NoError(t, err)
	var claims map[string]any
	require.NoError(t, json.Unmarshal(raw, &claims))
	return claims
}

func TestAccessTokenRoundTrip(t *testing.T) {
	now := time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)
	companyID := int64(7)

	token, expires, err := IssueAccessToken(jwtSecret, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "owner"}, now)
	require.NoError(t, err)

	assert.Equal(t, now.Add(15*time.Minute), expires)
	claims := payloadOf(t, token)
	assert.Equal(t, "998901234567", claims["sub"])
	assert.Equal(t, "app", claims["aud"], `the spec's aud = "app"`)
	assert.EqualValues(t, 7, claims["company_id"])
	assert.Equal(t, "owner", claims["role"])

	got, err := ParseAccessToken(jwtSecret, token, now.Add(14*time.Minute))
	require.NoError(t, err)
	assert.Equal(t, AccessClaims{Phone: "998901234567", CompanyID: &companyID, Role: "owner"}, got)
}
