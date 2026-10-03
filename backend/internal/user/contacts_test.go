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
	_, err := pool.Exec(ctx, "INSERT INTO users (phone) VALUES ('998901234567'), ('998902223344')")
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `WITH c AS (INSERT INTO companies (name, end_date) VALUES ('Olma', CURRENT_DATE) RETURNING id)
		INSERT INTO user_companies (user_phone, company_id, role) SELECT '998901234567', id, 'owner' FROM c`)
	require.NoError(t, err)
	contacts := NewContacts(pool)

	isUser, err := contacts.Save(ctx, 42, "+998 90 123 45 67", "ali", "Ali")
	require.NoError(t, err)
	assert.True(t, isUser, "a member of a company")

	isUser, err = contacts.Save(ctx, 43, "998902223344", "", "Vali")
	require.NoError(t, err)
	assert.False(t, isUser, "a user of no company may not sign in: no account to link")

	isUser, err = contacts.Save(ctx, 42, "+998 90 999 99 99", "", "Ali")
	require.NoError(t, err)
	assert.False(t, isUser, "a phone that is not a user yet is kept too")

	var phone string
	var username *string
	require.NoError(t, pool.QueryRow(ctx, "SELECT phone, username FROM telegram_contacts WHERE chat_id = 42").Scan(&phone, &username))
	assert.Equal(t, "998909999999", phone, "the chat's phone, normalized and updated")
	assert.Nil(t, username)
}
