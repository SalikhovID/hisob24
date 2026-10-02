// Package userbot is the user Telegram bot: it asks for the user's phone
// and links the chat to it.
package userbot

import (
	"context"
	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// API is the part of the Telegram Bot API the user bot uses. *bot.Bot
// implements it; tests use a fake.
type API interface {
	SendMessage(ctx context.Context, params *bot.SendMessageParams) (*models.Message, error)
	SetWebhook(ctx context.Context, params *bot.SetWebhookParams) (bool, error)
}

// Contacts keeps the phones people share, saying whether one is a user's.
type Contacts interface {
	Save(ctx context.Context, chatID int64, phone, username, firstName string) (bool, error)
}

const (
	askText     = "Assalomu alaykum! Hisob24 akkauntingizni ulash uchun telefon raqamingizni yuboring."
	shareButton = "📱 Raqamni yuborish"
)

// shareKeyboard is the reply keyboard with the button that sends the
// user's own contact.
var shareKeyboard = models.ReplyKeyboardMarkup{
	Keyboard:        [][]models.KeyboardButton{{{Text: shareButton, RequestContact: true}}},
	ResizeKeyboard:  true,
	OneTimeKeyboard: true,
}

// Handler answers the user bot's updates.
type Handler struct {
	api      API
	contacts Contacts
}

// NewHandler wires the bot's answers.
func NewHandler(api API, contacts Contacts) *Handler {
	return &Handler{api: api, contacts: contacts}
}

// Handle answers one update: /start asks for the phone.
func (h *Handler) Handle(ctx context.Context, update *models.Update) {
	if update.Message == nil || update.Message.From == nil {
		return
	}
	h.send(ctx, update.Message.Chat.ID, askText, shareKeyboard)
}

func (h *Handler) send(ctx context.Context, chatID int64, text string, markup models.ReplyMarkup) {
	if _, err := h.api.SendMessage(ctx, &bot.SendMessageParams{ChatID: chatID, Text: text, ReplyMarkup: markup}); err != nil {
		slog.ErrorContext(ctx, "user bot: send message", "chat", chatID, "err", err)
	}
}
