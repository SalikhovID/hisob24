package adminbot

import (
	"testing"

	"github.com/go-telegram/bot/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetMenuButton(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, SetMenuButton(t.Context(), api, "https://admin.hisob24.uz"))

	require.NotNil(t, api.menu)
	assert.Equal(t, models.MenuButtonWebApp{
		Type: models.MenuButtonTypeWebApp, Text: "Admin panel", WebApp: models.WebAppInfo{URL: "https://admin.hisob24.uz"},
	}, api.menu.MenuButton)

	api = &fakeAPI{}
	require.NoError(t, SetMenuButton(t.Context(), api, ""))
	assert.Nil(t, api.menu, "no panel URL, no button")
}

func TestRegisterWebhook(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, RegisterWebhook(t.Context(), api, "https://api.hisob24.uz/", "s3cret"))

	require.NotNil(t, api.webhook)
	assert.Equal(t, "https://api.hisob24.uz/webhooks/admin-bot", api.webhook.URL)
	assert.Equal(t, "s3cret", api.webhook.SecretToken)
}
