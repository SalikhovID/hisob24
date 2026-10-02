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
	linkedText  = "✅ Akkauntingiz ulandi"
	savedText   = "Raqamingiz saqlandi"
	failText    = "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring."
)

var removeKeyboard = models.ReplyKeyboardRemove{RemoveKeyboard: true}

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

// Handle answers one update: a shared contact is saved, anything else
// (/start first of all) asks for the phone.
func (h *Handler) Handle(ctx context.Context, update *models.Update) {
	msg := update.Message
	if msg == nil || msg.From == nil {
		return
	}
	if msg.Contact != nil {
		h.saveContact(ctx, msg)
		return
	}
	h.send(ctx, msg.Chat.ID, askText, shareKeyboard)
}

// saveContact keeps the shared phone and says whether it linked an account;
// the keyboard is not needed any more.
func (h *Handler) saveContact(ctx context.Context, msg *models.Message) {
	isUser, err := h.contacts.Save(ctx, msg.Chat.ID, msg.Contact.PhoneNumber, msg.From.Username, msg.From.FirstName)
	if err != nil {
		slog.ErrorContext(ctx, "user bot: save contact", "chat", msg.Chat.ID, "err", err)
		h.send(ctx, msg.Chat.ID, failText, shareKeyboard)
		return
	}
	answer := savedText
	if isUser {
		answer = linkedText
	}
	h.send(ctx, msg.Chat.ID, answer, removeKeyboard)
}

func (h *Handler) send(ctx context.Context, chatID int64, text string, markup models.ReplyMarkup) {
	if _, err := h.api.SendMessage(ctx, &bot.SendMessageParams{ChatID: chatID, Text: text, ReplyMarkup: markup}); err != nil {
		slog.ErrorContext(ctx, "user bot: send message", "chat", chatID, "err", err)
	}
}
