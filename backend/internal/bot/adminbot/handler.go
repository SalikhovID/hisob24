// Package adminbot is the admin Telegram bot: it hands out login codes and
// opens the admin panel as a Mini App.
package adminbot

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
)

// API is the part of the Telegram Bot API the admin bot uses. *bot.Bot
// implements it; tests use a fake.
type API interface {
	SendMessage(ctx context.Context, params *bot.SendMessageParams) (*models.Message, error)
	SetChatMenuButton(ctx context.Context, params *bot.SetChatMenuButtonParams) (bool, error)
	SetWebhook(ctx context.Context, params *bot.SetWebhookParams) (bool, error)
}

// Auth is what the bot needs from the admin auth service.
type Auth interface {
	IsActiveAdmin(ctx context.Context, telegramID int64) (bool, error)
	IssueLoginCode(ctx context.Context, telegramID int64) (auth.LoginCode, error)
	DiscardLoginCode(ctx context.Context, id int64) error
}

const (
	codeText     = "Kod: <code>%s</code> (1 daqiqa amal qiladi)"
	notAdminText = "Sizda ruxsat yo'q.\nTelegram ID: <code>%d</code>"
)

// Handler answers the admin bot's updates.
type Handler struct {
	api  API
	auth Auth
}

// NewHandler wires the bot's answers.
func NewHandler(api API, a Auth) *Handler {
	return &Handler{api: api, auth: a}
}

// Handle answers one update: /login gets a code.
func (h *Handler) Handle(ctx context.Context, update *models.Update) {
	if command(update.Message.Text) == "/login" {
		h.login(ctx, update.Message.Chat.ID, update.Message.From.ID)
	}
}

func (h *Handler) login(ctx context.Context, chatID, telegramID int64) {
	code, err := h.auth.IssueLoginCode(ctx, telegramID)
	if errors.Is(err, auth.ErrNotAdmin) {
		_ = h.send(ctx, chatID, fmt.Sprintf(notAdminText, telegramID))
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "admin bot: issue login code", "telegram_id", telegramID, "err", err)
		return
	}
	if err := h.send(ctx, chatID, fmt.Sprintf(codeText, code.Code)); err != nil {
		// The code never reached the admin, so it must not stay usable.
		if err := h.auth.DiscardLoginCode(ctx, code.ID); err != nil {
			slog.ErrorContext(ctx, "admin bot: discard login code", "code_id", code.ID, "err", err)
		}
	}
}

func (h *Handler) send(ctx context.Context, chatID int64, html string) error {
	_, err := h.api.SendMessage(ctx, &bot.SendMessageParams{ChatID: chatID, Text: html, ParseMode: models.ParseModeHTML})
	if err != nil {
		slog.ErrorContext(ctx, "admin bot: send message", "chat_id", chatID, "err", err)
	}
	return err
}

// command is the bot command a message starts with, without an @botname
// suffix: "/login@hisob24_bot now" is "/login".
func command(text string) string {
	fields := strings.Fields(text)
	if len(fields) == 0 || !strings.HasPrefix(fields[0], "/") {
		return ""
	}
	name, _, _ := strings.Cut(fields[0], "@")
	return name
}
