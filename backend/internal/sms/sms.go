// Package sms sends the user app's login codes: to the log in development,
// through Eskiz.uz in production.
package sms

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/config"
)

// Sender delivers a text to a phone (digits only, 998XXXXXXXXX).
type Sender interface {
	Send(ctx context.Context, phone, text string) error
}

// Text is the login code SMS. Eskiz sends only texts that match a template
// approved in the account; this is the account's approved one:
// "Hisob24 dasturiga kirish uchun tasdiqlash kodi: %d Uni hech kimga bermang."
func Text(code string) string {
	return "Hisob24 dasturiga kirish uchun tasdiqlash kodi: " + code + " Uni hech kimga bermang."
}

// New is the sender SMS_DRIVER names: eskiz sends for real, log (the
// default) only writes to logger.
func New(cfg config.Config, logger *slog.Logger) Sender {
	if cfg.SMSDriver == "eskiz" {
		return NewEskiz(EskizURL, cfg.EskizEmail, cfg.EskizPassword, cfg.EskizFrom, &http.Client{Timeout: 15 * time.Second})
	}
	return LogSender{Logger: logger}
}
