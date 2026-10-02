package sms

import (
	"bytes"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogSenderWritesTheSMSToTheLog(t *testing.T) {
	var out bytes.Buffer
	sender := LogSender{Logger: slog.New(slog.NewTextHandler(&out, nil))}

	require.NoError(t, sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 123456"))

	assert.Contains(t, out.String(), "phone=998901234567")
	assert.Contains(t, out.String(), `text="Hisob24 kirish kodi: 123456"`)
}
