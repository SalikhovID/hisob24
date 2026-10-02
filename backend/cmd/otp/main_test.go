package main

import (
	"bytes"
	"regexp"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func testEnv(pool *pgxpool.Pool, smsDriver string) func(string) string {
	env := map[string]string{
		"DATABASE_URL":    pool.Config().ConnString(),
		"OTP_HMAC_SECRET": "test-otp-secret",
		"JWT_SECRET":      "test-jwt-secret",
		"SMS_DRIVER":      smsDriver,
	}
	return func(key string) string { return env[key] }
}

func TestRunPrintsAWorkingCode(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	var out bytes.Buffer

	require.NoError(t, run(t.Context(), 0, testEnv(pool, "log"), &out))

	m := regexp.MustCompile(`^Kod: (\d{6}) \(1 daqiqa amal qiladi\), admin 461603558\n$`).FindStringSubmatch(out.String())
	require.Len(t, m, 2, out.String())
	_, err := auth.NewAdminAuth(pool, "test-otp-secret", "").LoginWithCode(t.Context(), m[1])
	assert.NoError(t, err)
}
