package sms

import (
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/config"
)

// The text has to match the template approved in the Eskiz account.
func TestText(t *testing.T) {
	assert.Equal(t, "Hisob24 kirish kodi: 123456", Text("123456"))
}

func TestNewPicksTheDriver(t *testing.T) {
	assert.IsType(t, LogSender{}, New(config.Config{SMSDriver: "log"}, slog.Default()))

	sender := New(config.Config{SMSDriver: "eskiz", EskizEmail: "sms@example.com", EskizPassword: "secret", EskizFrom: "4546"}, slog.Default())

	eskiz, ok := sender.(*EskizSender)
	require.True(t, ok, "got %T", sender)
	assert.Equal(t, EskizURL, eskiz.baseURL)
	assert.Equal(t, "sms@example.com", eskiz.email)
	assert.Equal(t, "4546", eskiz.from)
}
