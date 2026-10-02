package sms

import (
	"context"
	"log/slog"
)

// LogSender writes each SMS to the log instead of sending it: the driver
// for local development (SMS_DRIVER=log), the only place a code is logged.
type LogSender struct {
	Logger *slog.Logger
}

// Send logs the SMS.
func (s LogSender) Send(ctx context.Context, phone, text string) error {
	s.Logger.InfoContext(ctx, "sms (SMS_DRIVER=log, not sent)", "phone", phone, "text", text)
	return nil
}
