package userbot

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// SetMenuButton points the bot's menu button at the user app, so it opens as
// a Mini App that signs the user in by itself. An empty appURL leaves the
// button alone.
func SetMenuButton(ctx context.Context, api API, appURL string) error {
	if appURL == "" {
		return nil
	}
	_, err := api.SetChatMenuButton(ctx, &bot.SetChatMenuButtonParams{
		MenuButton: models.MenuButtonWebApp{
			Type:   models.MenuButtonTypeWebApp,
			Text:   "Hisob24",
			WebApp: models.WebAppInfo{URL: appURL},
		},
	})
	if err != nil {
		return fmt.Errorf("set menu button: %w", err)
	}
	return nil
}

// WebhookPath is where Telegram delivers the user bot's updates.
const WebhookPath = "/webhooks/user-bot"

// RegisterWebhook has Telegram deliver updates to publicURL+WebhookPath with
// secret in the X-Telegram-Bot-Api-Secret-Token header.
func RegisterWebhook(ctx context.Context, api API, publicURL, secret string) error {
	_, err := api.SetWebhook(ctx, &bot.SetWebhookParams{
		URL:         strings.TrimRight(publicURL, "/") + WebhookPath,
		SecretToken: secret,
	})
	if err != nil {
		return fmt.Errorf("set webhook: %w", err)
	}
	return nil
}
