package httpx

import (
	"crypto/subtle"
	"net/http"
)

// TelegramSecret lets a webhook call through only with the secret given to
// setWebhook. The bot library alone would answer a forged call with 200 and
// drop it silently.
func TelegramSecret(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(secret)) != 1 {
				Error(w, http.StatusUnauthorized, "invalid_secret_token", "Webhook secret noto'g'ri")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
