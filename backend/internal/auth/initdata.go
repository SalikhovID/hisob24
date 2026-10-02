package auth

import (
	"encoding/json"
	"errors"
	"net/url"
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

// ValidateInitData checks Mini App initData.
func ValidateInitData(initData, botToken string, maxAge time.Duration, now time.Time) (WebAppUser, error) {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return WebAppUser{}, ErrInvalidInitData
	}
	var user WebAppUser
	if err := json.Unmarshal([]byte(values.Get("user")), &user); err != nil || user.ID == 0 {
		return WebAppUser{}, ErrInvalidInitData
	}
	return user, nil
}
