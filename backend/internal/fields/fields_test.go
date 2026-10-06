package fields

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// refused asserts that err is a refusal for the client, of the kind, code
// and message given.
func refused(t *testing.T, err error, kind apperr.Kind, code, message string, about ...any) {
	t.Helper()
	var e *apperr.Error
	if assert.ErrorAs(t, err, &e, about...) {
		assert.Equal(t, kind, e.Kind, about...)
		assert.Equal(t, code, e.Code, about...)
		assert.Equal(t, message, e.Message, about...)
	}
}

func TestKindOf(t *testing.T) {
	for _, tt := range []struct {
		kind          string
		choice, known bool
	}{
		{KindString, false, true},
		{KindInt, false, true},
		{KindDropdown, true, true},
		{KindMultiDropdown, true, true},
		{KindRadio, true, true},
		{KindCheckbox, true, true},
		{"", false, false},
		{"date", false, false},
		{"String", false, false},
	} {
		choice, known := KindOf(tt.kind)
		assert.Equal(t, tt.choice, choice, "choice: %q", tt.kind)
		assert.Equal(t, tt.known, known, "known: %q", tt.kind)
	}
}

func TestCleanName(t *testing.T) {
	name, err := CleanName("  Manba ")
	require.NoError(t, err)
	assert.Equal(t, "Manba", name, "without the spaces around it")

	long := strings.Repeat("ў", MaxName) // 60 characters, 120 bytes
	name, err = CleanName(long)
	require.NoError(t, err, "characters are counted, not bytes")
	assert.Equal(t, long, name)

	_, err = CleanName("")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting")
	_, err = CleanName("   ")
	refused(t, err, apperr.Invalid, "validation_error", "Nomni kiriting", "spaces alone")
	_, err = CleanName(long + "a")
	refused(t, err, apperr.Invalid, "validation_error", "Nom 60 belgidan oshmasin")
}

func TestSameIDs(t *testing.T) {
	for _, tt := range []struct {
		name      string
		ids, live []int64
		want      bool
	}{
		{"the same in another order", []int64{3, 1, 2}, []int64{1, 2, 3}, true},
		{"nothing on both sides", nil, nil, true},
		{"one missing", []int64{1, 2}, []int64{1, 2, 3}, false},
		{"one too many", []int64{1, 2, 3, 4}, []int64{1, 2, 3}, false},
		{"a stranger in place of one", []int64{1, 2, 9}, []int64{1, 2, 3}, false},
		{"one twice in place of another", []int64{1, 1, 2}, []int64{1, 2, 3}, false},
	} {
		assert.Equal(t, tt.want, SameIDs(tt.ids, tt.live), tt.name)
	}
}

func TestTaken(t *testing.T) {
	unique := &pgconn.PgError{Code: "23505"}
	assert.True(t, Taken(unique), "a unique index refused the row")
	assert.True(t, Taken(fmt.Errorf("saving: %w", unique)), "wrapped")
	assert.False(t, Taken(&pgconn.PgError{Code: "23503"}), "a foreign key is another refusal")
	assert.False(t, Taken(errors.New("no")))
	assert.False(t, Taken(nil))
}

func TestInvalid(t *testing.T) {
	refused(t, Invalid("Nomni kiriting"), apperr.Invalid, "validation_error", "Nomni kiriting")
}

func TestErrOrderChanged(t *testing.T) {
	refused(t, ErrOrderChanged, apperr.Conflict, "order_changed", "Ro'yxat o'zgargan. Sahifani yangilang")
}
