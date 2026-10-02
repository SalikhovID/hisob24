package user

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

func TestSaveLinksAChatToAPhone(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	ctx := t.Context()
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901234567')")
	require.NoError(t, err)
	contacts := NewContacts(pool)

	isUser, err := contacts.Save(ctx, 42, "+998 90 123 45 67", "ali", "Ali")
	require.NoError(t, err)
	assert.True(t, isUser)

	isUser, err = contacts.Save(ctx, 42, "+998 90 999 99 99", "", "Ali")
	require.NoError(t, err)
	assert.False(t, isUser, "a phone that is not a user yet is kept too")

	var phone string
	var username *string
	require.NoError(t, pool.QueryRow(ctx, "SELECT phone, username FROM telegram_contacts WHERE chat_id = 42").Scan(&phone, &username))
	assert.Equal(t, "998909999999", phone, "the chat's phone, normalized and updated")
	assert.Nil(t, username)
}
