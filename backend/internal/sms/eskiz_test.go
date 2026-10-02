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

func TestEskizLogsInAgainWhenTheTokenExpired(t *testing.T) {
	fake := &fakeEskiz{tokens: []string{"tok-1", "tok-2"}, sendStatus: func(token string) int {
		if token == "Bearer tok-1" {
			return http.StatusUnauthorized
		}
		return http.StatusOK
	}}
	srv := fake.start(t)
	sender := NewEskiz(srv.URL, "sms@example.com", "secret", "4546", srv.Client())

	require.NoError(t, sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 123456"))

	fake.mu.Lock()
	defer fake.mu.Unlock()
	assert.Len(t, fake.logins, 2)
	assert.Equal(t, []string{"Bearer tok-1", "Bearer tok-2"}, fake.sendTokens)
}

func TestEskizGivesUpAfterASecond401(t *testing.T) {
	fake := &fakeEskiz{tokens: []string{"tok-1", "tok-2"}, sendStatus: func(string) int { return http.StatusUnauthorized }}
	srv := fake.start(t)
	sender := NewEskiz(srv.URL, "sms@example.com", "secret", "4546", srv.Client())

	err := sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 123456")

	assert.ErrorContains(t, err, "401")
	fake.mu.Lock()
	defer fake.mu.Unlock()
	assert.Len(t, fake.sends, 2, "one retry, no more")
}

func TestEskizRefusalCarriesItsMessage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/auth/login" {
			_, _ = io.WriteString(w, `{"data":{"token":"tok-1"}}`)
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"message":"Shablon tasdiqlanmagan","status":"error"}`)
	}))
	t.Cleanup(srv.Close)
	sender := NewEskiz(srv.URL, "sms@example.com", "secret", "4546", srv.Client())

	err := sender.Send(t.Context(), "998901234567", "Hisob24 kirish kodi: 123456")

	assert.ErrorContains(t, err, "status 400")
	assert.ErrorContains(t, err, "Shablon tasdiqlanmagan")
}
