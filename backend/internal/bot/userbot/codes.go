package userbot

import (
	"context"
	"fmt"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// codeText is the login code message: the code copies with a tap, as the
// admin bot's does. Two minutes is the code's life (auth.UserAuth).
const codeText = "Hisob24'ga kirish kodi: <code>%s</code>\n2 daqiqa amal qiladi. Uni hech kimga bermang."

// Codes sends the user app's login codes to the chats that shared their
// phones with the bot, in place of an SMS.
type Codes struct {
	api API
}

// NewCodes wires the code messages.
func NewCodes(api API) *Codes {
	return &Codes{api: api}
}

// SendLoginCode messages the chat its login code; the error says when the
// chat cannot be reached (the bot blocked, the chat gone), so the caller
// can fall back to an SMS.
func (c *Codes) SendLoginCode(ctx context.Context, chatID int64, code string) error {
	_, err := c.api.SendMessage(ctx, &bot.SendMessageParams{ChatID: chatID, Text: fmt.Sprintf(codeText, code), ParseMode: models.ParseModeHTML})
	if err != nil {
		return fmt.Errorf("send login code: %w", err)
	}
	return nil
}
