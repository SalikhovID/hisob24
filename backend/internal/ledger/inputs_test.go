package ledger

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
)

func TestPageOf(t *testing.T) {
	t.Parallel()
	require.NoError(t, PageOf(1))
	require.NoError(t, PageOf(1_000_000), "the last page whose offset fits int32")
	for name, page := range map[string]int{"zero": 0, "negative": -1, "past int32 offsets": 1_000_001} {
		refused(t, PageOf(page), apperr.Invalid, "validation_error", "Sahifa raqami noto'g'ri", name)
	}
}

func TestNote(t *testing.T) {
	t.Parallel()
	note, err := Note(nil)
	require.NoError(t, err)
	assert.Nil(t, note, "none is none")
	note, err = Note(ptr("   "))
	require.NoError(t, err)
	assert.Nil(t, note, "blank is none")
	note, err = Note(ptr("  Kechqurun  "))
	require.NoError(t, err)
	require.NotNil(t, note)
	assert.Equal(t, "Kechqurun", *note, "trimmed")
	long := strings.Repeat("ё", 500)
	note, err = Note(ptr(long))
	require.NoError(t, err)
	require.NotNil(t, note)
	assert.Equal(t, long, *note, "500 runes fit")
	_, err = Note(ptr(long + "ё"))
	refused(t, err, apperr.Invalid, "validation_error", "Izoh 500 belgidan oshmasin", "501 runes")
}

func TestAmount(t *testing.T) {
	t.Parallel()
	n, err := Amount(ptr("150000.50"))
	require.NoError(t, err)
	assert.Equal(t, "150000.50", *numtext.Amount(n))
	n, err = Amount(ptr("7"))
	require.NoError(t, err)
	assert.Equal(t, "7.00", *numtext.Amount(n))
	for name, tc := range map[string]struct {
		raw     *string
		message string
	}{
		"none":           {nil, "Summani kiriting"},
		"empty":          {ptr(""), "Summani kiriting"},
		"zero":           {ptr("0"), "Summa noto'g'ri"},
		"zero decimals":  {ptr("0.00"), "Summa noto'g'ri"},
		"negative":       {ptr("-5"), "Summa noto'g'ri"},
		"three decimals": {ptr("1.234"), "Summa noto'g'ri"},
		"words":          {ptr("abc"), "Summa noto'g'ri"},
	} {
		_, err := Amount(tc.raw)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
}

func TestDayRange(t *testing.T) {
	t.Parallel()
	start, end, err := DayRange("", "", "Asia/Tashkent")
	require.NoError(t, err)
	assert.Nil(t, start, "no day: no start")
	assert.Nil(t, end, "no day: no end")

	start, end, err = DayRange("2026-10-05", "2026-10-05", "Asia/Tashkent")
	require.NoError(t, err)
	require.NotNil(t, start)
	require.NotNil(t, end)
	assert.Equal(t, "2026-10-04T19:00:00Z", start.UTC().Format(time.RFC3339), "the day starts at midnight in the zone")
	assert.Equal(t, "2026-10-05T19:00:00Z", end.UTC().Format(time.RFC3339), "the end is the next midnight, excluded")

	start, end, err = DayRange("2026-10-05", "", "Asia/Tashkent")
	require.NoError(t, err)
	require.NotNil(t, start)
	assert.Nil(t, end, "from alone: open-ended")

	start, end, err = DayRange("", "2026-10-07", "Europe/Moscow")
	require.NoError(t, err)
	assert.Nil(t, start, "to alone: from the beginning")
	require.NotNil(t, end)
	assert.Equal(t, "2026-10-07T21:00:00Z", end.UTC().Format(time.RFC3339), "the zone counts")

	for name, tc := range map[string]struct{ from, to string }{
		"words":     {"yesterday", ""},
		"a moment":  {"2026-10-05T10:00", ""},
		"a month":   {"2026-10", ""},
		"backwards": {"2026-10-07", "2026-10-05"},
		"bad to":    {"2026-10-05", "2026-13-01"},
	} {
		_, _, err := DayRange(tc.from, tc.to, "Asia/Tashkent")
		refused(t, err, apperr.Invalid, "validation_error", "Sana noto'g'ri", name)
	}

	// The zone is the database's, never the client's: one unknown is a
	// failure of ours, not a refusal.
	_, _, err = DayRange("2026-10-05", "", "Mars/Olympus")
	require.Error(t, err)
	var refusal *apperr.Error
	assert.False(t, errors.As(err, &refusal), "not a refusal")
}

func TestAccountFor(t *testing.T) {
	q, pool := newQueries(t)
	ctx := t.Context()
	s := newShop(t, pool, "Olma")
	other := newShop(t, pool, "Anor")
	off := addAccount(t, pool, s.company, "Eski karta", 1, false)

	account, err := AccountFor(ctx, q, s.company, s.cash, 0)
	require.NoError(t, err)
	assert.Equal(t, s.cash, account.ID)
	assert.True(t, account.IsActive)

	kept, err := AccountFor(ctx, q, s.company, off, off)
	require.NoError(t, err, "the account the document already names stays, off or not")
	assert.Equal(t, off, kept.ID)

	for name, tc := range map[string]struct {
		id, keep int64
		message  string
	}{
		"none":              {0, 0, "Akkauntni tanlang"},
		"unknown":           {999_999, 0, "Akkauntni tanlang"},
		"another company's": {other.cash, 0, "Akkauntni tanlang"},
		"off":               {off, 0, "Akkaunt nofaol"},
		"off, another kept": {off, s.cash, "Akkaunt nofaol"},
	} {
		_, err := AccountFor(ctx, q, s.company, tc.id, tc.keep)
		refused(t, err, apperr.Invalid, "validation_error", tc.message, name)
	}
}
