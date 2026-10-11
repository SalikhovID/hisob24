package finance

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// namesOf is the names of the accounts, in order.
func namesOf(list []Account) []string {
	names := []string{}
	for _, a := range list {
		names = append(names, a.Name)
	}
	return names
}

func TestAccounts(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")

	list, err := s.Accounts(ctx, olma)
	require.NoError(t, err)
	require.Len(t, list, 1, "the cash every company starts with")
	assert.Equal(t, "Naqd", list[0].Name)
	assert.EqualValues(t, 1, list[0].CurrencyID)
	assert.True(t, list[0].Active)

	_, err = s.AddAccount(ctx, olma, adminID, AccountInput{Name: " Karta ", CurrencyID: 2})
	refused(t, err, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan", "the dollar is off")
	turnOn(t, pool, olma, 2)
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: " Karta ", CurrencyID: 2})
	require.NoError(t, err)
	assert.Positive(t, card.ID)
	assert.Equal(t, "Karta", card.Name, "trimmed")
	assert.EqualValues(t, 2, card.CurrencyID)
	assert.True(t, card.Active)
	assert.Equal(t, card.CreatedAt, card.UpdatedAt)

	for name, tc := range map[string]struct {
		in      AccountInput
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":        {AccountInput{Name: " ", CurrencyID: 1}, apperr.Invalid, "validation_error", "Nomni kiriting"},
		"a long name":    {AccountInput{Name: strings.Repeat("a", 61), CurrencyID: 1}, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin"},
		"no currency":    {AccountInput{Name: "Bank", CurrencyID: 0}, apperr.Invalid, "validation_error", "Valyutani tanlang"},
		"not a currency": {AccountInput{Name: "Bank", CurrencyID: 9}, apperr.Invalid, "validation_error", "Valyuta noto'g'ri"},
		"a taken name":   {AccountInput{Name: "karta", CurrencyID: 1}, apperr.Conflict, "name_taken", "Bu nomli akkaunt allaqachon bor"},
	} {
		_, err := s.AddAccount(ctx, olma, adminID, tc.in)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}
	_, err = s.AddAccount(ctx, nok, adminID, AccountInput{Name: "Karta", CurrencyID: 1})
	require.NoError(t, err, "another company has its own names")
	_, err = s.AddAccount(ctx, nok+1000, adminID, AccountInput{Name: "Karta", CurrencyID: 1})
	refused(t, err, apperr.NotFound, "not_found", "Kompaniya topilmadi")

	list, err = s.Accounts(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"Naqd", "Karta"}, namesOf(list), "in the order added")
}

func TestUpdateAndDeleteAccount(t *testing.T) {
	s, pool := newService(t)
	ctx := t.Context()
	olma := addCompany(t, pool, "Olma")
	nok := addCompany(t, pool, "Nok")
	turnOn(t, pool, olma, 2)
	accounts, err := s.Accounts(ctx, olma)
	require.NoError(t, err)
	cash := accounts[0]
	card, err := s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Karta", CurrencyID: 1})
	require.NoError(t, err)

	renamed, err := s.UpdateAccount(ctx, olma, card.ID, AccountPatch{Name: ptr(" Humo "), CurrencyID: ptr(int64(2))})
	require.NoError(t, err)
	assert.Equal(t, "Humo", renamed.Name)
	assert.EqualValues(t, 2, renamed.CurrencyID)
	assert.True(t, renamed.Active, "what is not given stays")
	off, err := s.UpdateAccount(ctx, olma, card.ID, AccountPatch{Active: ptr(false)})
	require.NoError(t, err)
	assert.False(t, off.Active)
	assert.Equal(t, "Humo", off.Name)

	_, err = s.UpdateAccount(ctx, olma, cash.ID, AccountPatch{Active: ptr(false)})
	refused(t, err, apperr.Conflict, "last_account", "Kompaniyada kamida bitta faol akkaunt qolsin", "the last active account stays on")
	err = s.DeleteAccount(ctx, olma, cash.ID)
	refused(t, err, apperr.Conflict, "last_account", "Kompaniyada kamida bitta faol akkaunt qolsin", "nor is it deleted")
	_, err = s.UpdateAccount(ctx, olma, cash.ID, AccountPatch{Active: ptr(true)})
	require.NoError(t, err, "turning the active one on again is nothing")

	for name, tc := range map[string]struct {
		patch   AccountPatch
		kind    apperr.Kind
		code    string
		message string
	}{
		"no name":        {AccountPatch{Name: ptr(" ")}, apperr.Invalid, "validation_error", "Nomni kiriting"},
		"not a currency": {AccountPatch{CurrencyID: ptr(int64(9))}, apperr.Invalid, "validation_error", "Valyuta noto'g'ri"},
		"a currency off": {AccountPatch{CurrencyID: ptr(int64(3))}, apperr.Invalid, "currency_not_allowed", "Bu valyuta kompaniyada yoqilmagan"},
		"a taken name":   {AccountPatch{Name: ptr("NAQD")}, apperr.Conflict, "name_taken", "Bu nomli akkaunt allaqachon bor"},
	} {
		_, err := s.UpdateAccount(ctx, olma, card.ID, tc.patch)
		refused(t, err, tc.kind, tc.code, tc.message, name)
	}
	_, err = s.UpdateAccount(ctx, nok, card.ID, AccountPatch{Name: ptr("Bank")})
	refused(t, err, apperr.NotFound, "not_found", "Akkaunt topilmadi", "another company's account")

	require.NoError(t, s.DeleteAccount(ctx, olma, card.ID))
	err = s.DeleteAccount(ctx, olma, card.ID)
	refused(t, err, apperr.NotFound, "not_found", "Akkaunt topilmadi", "deleted already")
	accounts, err = s.Accounts(ctx, olma)
	require.NoError(t, err)
	assert.Equal(t, []string{"Naqd"}, namesOf(accounts))
	_, err = s.AddAccount(ctx, olma, adminID, AccountInput{Name: "Humo", CurrencyID: 1})
	require.NoError(t, err, "a deleted account's name is free again")
}
