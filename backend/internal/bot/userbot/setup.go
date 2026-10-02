package userbot

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-telegram/bot"
)

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
