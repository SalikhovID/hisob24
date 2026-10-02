package httpx

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDecodeJSON(t *testing.T) {
	var body struct {
		Code string `json:"code"`
	}

	rec := httptest.NewRecorder()
	ok := DecodeJSON(rec, httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(`{"code":"123456"}`)), &body)
	assert.True(t, ok)
	assert.Equal(t, "123456", body.Code)

	rec = httptest.NewRecorder()
	ok = DecodeJSON(rec, httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader(`{"code":`)), &body)
	assert.False(t, ok)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.JSONEq(t, `{"error":"bad_request","message":"So'rov noto'g'ri"}`, rec.Body.String())
}

func TestInternalError(t *testing.T) {
	rec := httptest.NewRecorder()

	InternalError(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/x", nil), errors.New("db down"))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.JSONEq(t, `{"error":"internal_error","message":"Ichki xatolik. Birozdan keyin qayta urinib ko'ring"}`, rec.Body.String())
}
