package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"maps"
	"net/url"
	"slices"
	"strings"
	"time"
)

// WebAppUser is the user object inside Mini App initData.
type WebAppUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
}

// ErrInvalidInitData means initData is malformed or not signed by the bot.
var ErrInvalidInitData = errors.New("invalid init data")

// ValidateInitData checks Mini App initData the way Telegram documents it
// (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
// every field but hash, sorted by key and joined with "\n", must carry the
// HMAC-SHA256 under the key HMAC-SHA256("WebAppData", botToken).
func ValidateInitData(initData, botToken string, maxAge time.Duration, now time.Time) (WebAppUser, error) {
	values, err := url.ParseQuery(initData)
	if err != nil || botToken == "" {
		return WebAppUser{}, ErrInvalidInitData
	}
	hash := values.Get("hash")
	values.Del("hash")
	lines := make([]string, 0, len(values))
	for _, key := range slices.Sorted(maps.Keys(values)) {
		lines = append(lines, key+"="+values.Get(key))
	}
	secret := hmac.New(sha256.New, []byte("WebAppData"))
	secret.Write([]byte(botToken))
	mac := hmac.New(sha256.New, secret.Sum(nil))
	mac.Write([]byte(strings.Join(lines, "\n")))
	want, err := hex.DecodeString(hash)
	if err != nil || hash == "" || !hmac.Equal(mac.Sum(nil), want) {
		return WebAppUser{}, ErrInvalidInitData
	}

	var user WebAppUser
	if err := json.Unmarshal([]byte(values.Get("user")), &user); err != nil || user.ID == 0 {
		return WebAppUser{}, ErrInvalidInitData
	}
	return user, nil
}
