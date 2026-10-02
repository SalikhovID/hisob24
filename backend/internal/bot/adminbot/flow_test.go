package adminbot

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
	"github.com/SalikhovID/hisob24/backend/internal/testutil/pgtest"
)

// The spec's admin login end to end: /login in the bot, the code from the
// message, a session.
func TestACodeFromTheBotLogsIn(t *testing.T) {
	t.Parallel()
	pool := pgtest.New(t)
	a := auth.NewAdminAuth(pool, "test-otp-secret", "")
	api := &fakeAPI{}

	NewHandler(api, a).Handle(t.Context(), message(461603558, "/login"))

	require.Len(t, api.sent, 1)
	code := regexp.MustCompile(`<code>(\d{6})</code>`).FindStringSubmatch(api.sent[0].Text)
	require.Len(t, code, 2, api.sent[0].Text)
	s, err := a.LoginWithCode(t.Context(), code[1])
	require.NoError(t, err)
	assert.Equal(t, int64(461603558), s.Admin.TelegramID)
}
