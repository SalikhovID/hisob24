package sms

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeEskiz answers like notify.eskiz.uz: a login hands out tokens[i] for
// the i-th login, a send is answered with sendStatus(token).
type fakeEskiz struct {
	mu         sync.Mutex
	tokens     []string
	sendStatus func(token string) int
	logins     []url.Values
	sends      []url.Values
	sendTokens []string
}

func (f *fakeEskiz) start(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		switch r.URL.Path {
		case "/api/auth/login":
			token := f.tokens[len(f.logins)]
			f.logins = append(f.logins, r.PostForm)
			_, _ = io.WriteString(w, `{"message":"token_generated","data":{"token":"`+token+`"},"token_type":"bearer"}`)
		case "/api/message/sms/send":
			token := r.Header.Get("Authorization")
			f.sends = append(f.sends, r.PostForm)
			f.sendTokens = append(f.sendTokens, token)
			status := http.StatusOK
			if f.sendStatus != nil {
				status = f.sendStatus(token)
			}
			w.WriteHeader(status)
			_, _ = io.WriteString(w, `{"id":"1","message":"Waiting for SMS provider","status":"waiting"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestEskizLogsInOnceAndSends(t *testing.T) {
	fake := &fakeEskiz{tokens: []string{"tok-1"}}
	srv := fake.start(t)
	sender := NewEskiz(srv.URL, "sms@example.com", "secret", "4546", srv.Client())

	require.NoError(t, sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 123456"))
	require.NoError(t, sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 654321"))

	fake.mu.Lock()
	defer fake.mu.Unlock()
	require.Len(t, fake.logins, 1, "the token is kept between sends")
	assert.Equal(t, "sms@example.com", fake.logins[0].Get("email"))
	assert.Equal(t, "secret", fake.logins[0].Get("password"))
	require.Len(t, fake.sends, 2)
	assert.Equal(t, []string{"Bearer tok-1", "Bearer tok-1"}, fake.sendTokens)
	assert.Equal(t, "998901234567", fake.sends[1].Get("mobile_phone"))
	assert.Equal(t, "Hisob24 kirish kodi: 654321", fake.sends[1].Get("message"))
	assert.Equal(t, "4546", fake.sends[1].Get("from"))
}
