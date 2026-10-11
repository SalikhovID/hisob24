package ledger

import (
	"strings"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/fields"
)

// At reads a document's moment as the client sends it (RFC 3339, with its
// offset): one is needed ("Vaqtni kiriting"), and it has to be a moment
// ("Vaqt noto'g'ri"). It is kept in UTC; it is shown in the member's time
// zone (logic/user.md).
func At(raw string) (time.Time, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return time.Time{}, fields.Invalid("Vaqtni kiriting")
	}
	at, err := time.Parse(time.RFC3339Nano, text)
	if err != nil {
		return time.Time{}, fields.Invalid("Vaqt noto'g'ri")
	}
	return at.UTC(), nil
}
