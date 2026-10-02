// Package telegramtest builds Telegram data for tests.
package telegramtest

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"strings"
	"time"
)

// SignInitData returns Mini App initData for user telegramID, signed for
// botToken at signedAt the way Telegram signs it.
func SignInitData(botToken string, telegramID int64, signedAt time.Time) string {
	fields := map[string]string{
		"auth_date": fmt.Sprint(signedAt.Unix()),
		"query_id":  "AAHtest",
		"user":      fmt.Sprintf(`{"id":%d,"first_name":"Test"}`, telegramID),
	}
	lines := make([]string, 0, len(fields))
	for _, key := range slices.Sorted(maps.Keys(fields)) {
		lines = append(lines, key+"="+fields[key])
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(botToken))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))

	values := url.Values{}
	for key, value := range fields {
		values.Set(key, value)
	}
	values.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return values.Encode()
}
