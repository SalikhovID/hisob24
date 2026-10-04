package customer

import (
	"strings"

	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// customerPhone is a customer's phone as it is kept: an Uzbek number, 998
// and nine digits.
func customerPhone(raw string) (string, error) {
	phone, err := user.NormalizePhone(raw)
	if err != nil || len(phone) != 12 || !strings.HasPrefix(phone, "998") {
		return "", invalid("Telefon raqami noto'g'ri")
	}
	return phone, nil
}
