package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTelegramSecret(t *testing.T) {
	h := TelegramSecret("s3cret")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for name, tc := range map[string]struct {
		header string
		want   int
	}{
		"right secret": {"s3cret", http.StatusOK},
		"wrong secret": {"guess", http.StatusUnauthorized},
		"no secret":    {"", http.StatusUnauthorized},
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/webhooks/admin-bot", nil)
		if tc.header != "" {
			req.Header.Set("X-Telegram-Bot-Api-Secret-Token", tc.header)
		}
		h.ServeHTTP(rec, req)
		assert.Equal(t, tc.want, rec.Code, name)
	}
}
