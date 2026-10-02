package userbot

import (
	"context"
	"testing"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeAPI struct {
	sent    []*bot.SendMessageParams
	webhook *bot.SetWebhookParams
}

func (f *fakeAPI) SendMessage(_ context.Context, p *bot.SendMessageParams) (*models.Message, error) {
	f.sent = append(f.sent, p)
	return &models.Message{}, nil
}

func (f *fakeAPI) SetWebhook(_ context.Context, p *bot.SetWebhookParams) (bool, error) {
	f.webhook = p
	return true, nil
}

type saved struct {
	chatID                     int64
	phone, username, firstName string
}

type fakeContacts struct {
	saved  []saved
	isUser bool
	err    error
}

func (f *fakeContacts) Save(_ context.Context, chatID int64, phone, username, firstName string) (bool, error) {
	f.saved = append(f.saved, saved{chatID, phone, username, firstName})
	return f.isUser, f.err
}

const aliID = 7001

func text(s string) *models.Update {
	return &models.Update{Message: &models.Message{
		Chat: models.Chat{ID: aliID},
		From: &models.User{ID: aliID, Username: "ali", FirstName: "Ali"},
		Text: s,
	}}
}

func TestStartAsksForThePhoneWithAContactButton(t *testing.T) {
	api := &fakeAPI{}

	NewHandler(api, &fakeContacts{}).Handle(t.Context(), text("/start"))

	require.Len(t, api.sent, 1)
	assert.EqualValues(t, aliID, api.sent[0].ChatID)
	assert.Equal(t, "Assalomu alaykum! Hisob24 akkauntingizni ulash uchun telefon raqamingizni yuboring.", api.sent[0].Text)
	keyboard, ok := api.sent[0].ReplyMarkup.(models.ReplyKeyboardMarkup)
	require.True(t, ok, "a reply keyboard, got %T", api.sent[0].ReplyMarkup)
	assert.Equal(t, [][]models.KeyboardButton{{{Text: "📱 Raqamni yuborish", RequestContact: true}}}, keyboard.Keyboard)
	assert.True(t, keyboard.ResizeKeyboard)
	assert.True(t, keyboard.OneTimeKeyboard)
}

// contact is the user sharing a contact; ownerID is whose it is.
func contact(ownerID int64, phone string) *models.Update {
	update := text("")
	update.Message.Contact = &models.Contact{PhoneNumber: phone, FirstName: "Ali", UserID: ownerID}
	return update
}

func TestOwnContactIsSavedAndAnswered(t *testing.T) {
	for name, tc := range map[string]struct {
		isUser bool
		answer string
	}{
		"a user":         {true, "✅ Akkauntingiz ulandi"},
		"not yet a user": {false, "Raqamingiz saqlandi"},
	} {
		api := &fakeAPI{}
		contacts := &fakeContacts{isUser: tc.isUser}

		NewHandler(api, contacts).Handle(t.Context(), contact(aliID, "+998901234567"))

		assert.Equal(t, []saved{{aliID, "+998901234567", "ali", "Ali"}}, contacts.saved, name)
		require.Len(t, api.sent, 1, name)
		assert.Equal(t, tc.answer, api.sent[0].Text, name)
		assert.Equal(t, models.ReplyKeyboardRemove{RemoveKeyboard: true}, api.sent[0].ReplyMarkup, name+": the keyboard goes")
	}
}

func TestSomeoneElsesContactIsNotSaved(t *testing.T) {
	for name, owner := range map[string]int64{"another user's": 9999, "not a Telegram user's": 0} {
		api := &fakeAPI{}
		contacts := &fakeContacts{}

		NewHandler(api, contacts).Handle(t.Context(), contact(owner, "+998902223344"))

		assert.Empty(t, contacts.saved, name)
		require.Len(t, api.sent, 1, name)
		assert.Equal(t, "Iltimos, o'z raqamingizni yuboring", api.sent[0].Text, name)
		assert.IsType(t, models.ReplyKeyboardMarkup{}, api.sent[0].ReplyMarkup, name+": the button stays")
	}
}
