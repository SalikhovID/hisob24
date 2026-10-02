package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
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

func TestConsumeSMSCode(t *testing.T) {
	q, _ := setup(t)
	ctx := t.Context()
	storeSMSCode(t, q, "998901111111", "right", time.Now().Add(2*time.Minute))
	storeSMSCode(t, q, "998902222222", "late", time.Now().Add(-time.Second))

	_, err := q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "wrong"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a wrong code")
	phone, err := q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "right"})
	require.NoError(t, err)
	assert.Equal(t, "998901111111", phone)
	_, err = q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998901111111", CodeHash: "right"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "a code works once")
	_, err = q.ConsumeSMSCode(ctx, gen.ConsumeSMSCodeParams{Phone: "998902222222", CodeHash: "late"})
	assert.ErrorIs(t, err, pgx.ErrNoRows, "an expired code")
}

func storeSMSCode(t *testing.T, q *gen.Queries, phone, hash string, expiresAt time.Time) {
	t.Helper()
	n, err := q.UpsertSMSCode(context.Background(), gen.UpsertSMSCodeParams{Phone: phone, CodeHash: hash, ExpiresAt: expiresAt, CooldownSeconds: 60})
	require.NoError(t, err)
	require.Equal(t, int64(1), n)
}
