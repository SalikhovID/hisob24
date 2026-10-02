package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestUpsertSMSCode(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()
	const phone = "998901234567"
	send := func(hash string) int64 {
		t.Helper()
		n, err := q.UpsertSMSCode(ctx, gen.UpsertSMSCodeParams{Phone: phone, CodeHash: hash, ExpiresAt: time.Now().Add(2 * time.Minute), CooldownSeconds: 60})
		require.NoError(t, err)
		return n
	}

	assert.Equal(t, int64(1), send("first"))
	assert.Zero(t, send("second"), "a second code within the cooldown is refused")
	assert.Equal(t, "first", smsCodeHash(t, pool, phone))

	mustExec(t, pool, "UPDATE sms_codes SET sent_at = now() - interval '61 seconds', attempts = 3 WHERE phone = $1", phone)
	assert.Equal(t, int64(1), send("third"))
	assert.Equal(t, "third", smsCodeHash(t, pool, phone))
	var attempts int
	require.NoError(t, pool.QueryRow(ctx, "SELECT attempts FROM sms_codes WHERE phone = $1", phone).Scan(&attempts))
	assert.Zero(t, attempts, "a new code starts with no failed attempts")
}

func smsCodeHash(t *testing.T, pool *pgxpool.Pool, phone string) string {
	t.Helper()
	var hash string
	require.NoError(t, pool.QueryRow(context.Background(), "SELECT code_hash FROM sms_codes WHERE phone = $1", phone).Scan(&hash))
	return hash
}
