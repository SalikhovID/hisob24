package userbot

import (
	"errors"
	"testing"

	"github.com/go-telegram/bot/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSendLoginCodeIsACopyableCodeInTheChat(t *testing.T) {
	api := &fakeAPI{}

	require.NoError(t, NewCodes(api).SendLoginCode(t.Context(), aliID, "123456"))

	require.Len(t, api.sent, 1)
	assert.EqualValues(t, aliID, api.sent[0].ChatID)
	assert.Equal(t, "Hisob24'ga kirish kodi: <code>123456</code>\n2 daqiqa amal qiladi. Uni hech kimga bermang.", api.sent[0].Text)
	assert.Equal(t, models.ParseModeHTML, api.sent[0].ParseMode)
}

func TestSendLoginCodeReportsAChatItCouldNotReach(t *testing.T) {
	api := &fakeAPI{err: errors.New("Forbidden: bot was blocked by the user")}

	err := NewCodes(api).SendLoginCode(t.Context(), aliID, "123456")

	assert.ErrorContains(t, err, "bot was blocked")
}
