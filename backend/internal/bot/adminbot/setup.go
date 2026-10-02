package adminbot

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// SetMenuButton points the bot's menu button at the admin panel, so the
// panel opens as a Mini App. An empty panelURL leaves the button alone.
func SetMenuButton(ctx context.Context, api API, panelURL string) error {
	if panelURL == "" {
		return nil
	}
	_, err := api.SetChatMenuButton(ctx, &bot.SetChatMenuButtonParams{
		MenuButton: models.MenuButtonWebApp{
			Type:   models.MenuButtonTypeWebApp,
			Text:   "Admin panel",
			WebApp: models.WebAppInfo{URL: panelURL},
		},
	})
	if err != nil {
		return fmt.Errorf("set menu button: %w", err)
	}
	return nil
}

// WebhookPath is where Telegram delivers the admin bot's updates.
const WebhookPath = "/webhooks/admin-bot"

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
