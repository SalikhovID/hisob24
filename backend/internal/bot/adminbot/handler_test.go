package adminbot

import (
	"context"
	"errors"
	"testing"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/auth"
)

type fakeAPI struct {
	sent    []*bot.SendMessageParams
	sendErr error
	menu    *bot.SetChatMenuButtonParams
	webhook *bot.SetWebhookParams
}

func (f *fakeAPI) SendMessage(_ context.Context, p *bot.SendMessageParams) (*models.Message, error) {
	f.sent = append(f.sent, p)
	return &models.Message{}, f.sendErr
}

func (f *fakeAPI) SetChatMenuButton(_ context.Context, p *bot.SetChatMenuButtonParams) (bool, error) {
	f.menu = p
	return true, nil
}

func (f *fakeAPI) SetWebhook(_ context.Context, p *bot.SetWebhookParams) (bool, error) {
	f.webhook = p
	return true, nil
}

type fakeAuth struct {
	admins    map[int64]bool
	issued    []int64
	discarded []int64
}

func (f *fakeAuth) IsActiveAdmin(_ context.Context, id int64) (bool, error) { return f.admins[id], nil }

func (f *fakeAuth) IssueLoginCode(_ context.Context, id int64) (auth.LoginCode, error) {
	if !f.admins[id] {
		return auth.LoginCode{}, auth.ErrNotAdmin
	}
	f.issued = append(f.issued, id)
	return auth.LoginCode{ID: 7, Code: "123456"}, nil
}

func (f *fakeAuth) DiscardLoginCode(_ context.Context, id int64) error {
	f.discarded = append(f.discarded, id)
	return nil
}

// message is an update with a text message from telegramID in its private chat.
func message(telegramID int64, text string) *models.Update {
	return &models.Update{Message: &models.Message{
		Chat: models.Chat{ID: telegramID},
		From: &models.User{ID: telegramID},
		Text: text,
	}}
}

func TestLoginSendsACode(t *testing.T) {
	for _, text := range []string{"/login", "/login@hisob24_admin_bot"} {
		api, a := &fakeAPI{}, &fakeAuth{admins: map[int64]bool{100: true}}

		NewHandler(api, a).Handle(t.Context(), message(100, text))

		require.Len(t, api.sent, 1, text)
		assert.Equal(t, int64(100), api.sent[0].ChatID)
		assert.Equal(t, "Kod: <code>123456</code> (1 daqiqa amal qiladi)", api.sent[0].Text)
		assert.Equal(t, models.ParseModeHTML, api.sent[0].ParseMode)
		assert.Equal(t, []int64{100}, a.issued)
	}
}

func TestLoginRefusesStrangers(t *testing.T) {
	api, a := &fakeAPI{}, &fakeAuth{admins: map[int64]bool{}}

	NewHandler(api, a).Handle(t.Context(), message(42, "/login"))

	require.Len(t, api.sent, 1)
	assert.Equal(t, "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>", api.sent[0].Text)
	assert.Empty(t, a.issued)
}

func TestLoginDiscardsAnUndeliveredCode(t *testing.T) {
	api, a := &fakeAPI{sendErr: errors.New("telegram is down")}, &fakeAuth{admins: map[int64]bool{100: true}}

	NewHandler(api, a).Handle(t.Context(), message(100, "/login"))

	assert.Equal(t, []int64{7}, a.discarded)
}

func TestOtherMessages(t *testing.T) {
	for name, tc := range map[string]struct {
		from int64
		text string
		want string
	}{
		"admin /start":    {100, "/start", "Admin panelga kirish uchun /login yozing."},
		"admin text":      {100, "salom", "Admin panelga kirish uchun /login yozing."},
		"stranger /start": {42, "/start", "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>"},
		"stranger text":   {42, "salom", "Sizda ruxsat yo'q.\nTelegram ID: <code>42</code>"},
	} {
		api := &fakeAPI{}
		NewHandler(api, &fakeAuth{admins: map[int64]bool{100: true}}).Handle(t.Context(), message(tc.from, tc.text))
		require.Len(t, api.sent, 1, name)
		assert.Equal(t, tc.want, api.sent[0].Text, name)
	}
}

func TestUpdatesWithoutAMessageAreIgnored(t *testing.T) {
	api := &fakeAPI{}
	h := NewHandler(api, &fakeAuth{})

	h.Handle(t.Context(), &models.Update{})
	h.Handle(t.Context(), &models.Update{Message: &models.Message{Text: "/login"}})

	assert.Empty(t, api.sent)
}
