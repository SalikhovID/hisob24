package userbot

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// A contact shared with the bot lands in telegram_contacts and links the
// account of a user who is in a company.
func TestSharedContactIsKept(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	_, err := pool.Exec(t.Context(), "INSERT INTO users (phone) VALUES ('998901234567')")
	require.NoError(t, err)
	_, err = pool.Exec(t.Context(), `WITH c AS (INSERT INTO companies (name, end_date) VALUES ('Olma', CURRENT_DATE) RETURNING id)
		INSERT INTO user_companies (user_phone, company_id, role) SELECT '998901234567', id, 'owner' FROM c`)
	require.NoError(t, err)
	api := &fakeAPI{}

	NewHandler(api, user.NewContacts(pool)).Handle(t.Context(), contact(aliID, "+998901234567"))

	require.Len(t, api.sent, 1)
	assert.Equal(t, "✅ Akkauntingiz ulandi", api.sent[0].Text)
	var phone string
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT phone FROM telegram_contacts WHERE chat_id = $1", aliID).Scan(&phone))
	assert.Equal(t, "998901234567", phone)
}
