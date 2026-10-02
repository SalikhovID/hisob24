package userbot

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterWebhook(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, RegisterWebhook(t.Context(), api, "https://api.example.com/", "s3cret"))

	require.NotNil(t, api.webhook)
	assert.Equal(t, "https://api.example.com/webhooks/user-bot", api.webhook.URL)
	assert.Equal(t, "s3cret", api.webhook.SecretToken)
}
