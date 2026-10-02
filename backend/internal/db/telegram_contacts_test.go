package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

func TestUpsertTelegramContact(t *testing.T) {
	q, pool := setup(t)
	ctx := t.Context()

	require.NoError(t, q.UpsertTelegramContact(ctx, gen.UpsertTelegramContactParams{ChatID: 777, Phone: "998901234567", Username: ptr("ali"), FirstName: ptr("Ali")}))
	mustExec(t, pool, "UPDATE telegram_contacts SET created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour'")
	require.NoError(t, q.UpsertTelegramContact(ctx, gen.UpsertTelegramContactParams{ChatID: 777, Phone: "998909999999", FirstName: ptr("Ali")}))

	var phone string
	var username *string
	var newer bool
	require.NoError(t, pool.QueryRow(ctx, "SELECT phone, username, updated_at > created_at FROM telegram_contacts WHERE chat_id = 777").Scan(&phone, &username, &newer))
	assert.Equal(t, "998909999999", phone, "the chat's latest contact wins")
	assert.Nil(t, username)
	assert.True(t, newer, "updated_at moves on every upsert")
}
