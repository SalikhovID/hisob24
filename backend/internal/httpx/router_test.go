package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
)

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/healthz", nil)

	NewRouter().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
}

func TestNewRouterMountsRoutes(t *testing.T) {
	r := NewRouter(func(r chi.Router) {
		r.Get("/ping", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	})
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/ping", nil))

	assert.Equal(t, http.StatusTeapot, rec.Code)
}
