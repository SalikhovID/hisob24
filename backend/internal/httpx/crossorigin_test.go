package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCrossOriginGuard(t *testing.T) {
	guard, err := CrossOriginGuard("https://admin.example.com/")
	require.NoError(t, err)
	h := guard(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))

	for name, tc := range map[string]struct {
		method  string
		headers map[string]string
		code    int
	}{
		"another site posts":              {http.MethodPost, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusForbidden},
		"another site deletes":            {http.MethodDelete, map[string]string{"Sec-Fetch-Site": "same-site"}, http.StatusForbidden},
		"the panel posts":                 {http.MethodPost, map[string]string{"Sec-Fetch-Site": "same-origin"}, http.StatusNoContent},
		"another site reads":              {http.MethodGet, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusNoContent},
		"the panel from an older browser": {http.MethodPost, map[string]string{"Origin": "https://admin.example.com"}, http.StatusNoContent},
		"another origin, older browser":   {http.MethodPost, map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		"no browser (curl, Telegram)":     {http.MethodPost, nil, http.StatusNoContent},
	} {
		req := httptest.NewRequestWithContext(t.Context(), tc.method, "/admin/admins", nil)
		for k, v := range tc.headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		assert.Equal(t, tc.code, rec.Code, name)
		if tc.code == http.StatusForbidden {
			assert.JSONEq(t, `{"error":"forbidden","message":"Boshqa saytdan kelgan so'rov rad etildi"}`, rec.Body.String(), name)
		}
	}
}

func TestCrossOriginGuardRefusesABadTrustedOrigin(t *testing.T) {
	_, err := CrossOriginGuard("not a url")
	assert.Error(t, err)
}
