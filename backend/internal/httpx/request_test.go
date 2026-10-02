package httpx

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
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

func TestWriteError(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		code int
		body string
	}{
		"invalid":   {apperr.New(apperr.Invalid, "validation_error", "Nomi kiritilmagan"), 400, `{"error":"validation_error","message":"Nomi kiritilmagan"}`},
		"not found": {apperr.New(apperr.NotFound, "not_found", "Topilmadi"), 404, `{"error":"not_found","message":"Topilmadi"}`},
		"conflict":  {fmt.Errorf("deactivate: %w", apperr.New(apperr.Conflict, "last_admin", "Kamida bitta")), 409, `{"error":"last_admin","message":"Kamida bitta"}`},
		"other":     {errors.New("db down"), 500, `{"error":"internal_error","message":"Ichki xatolik. Birozdan keyin qayta urinib ko'ring"}`},
	} {
		rec := httptest.NewRecorder()
		WriteError(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil), tc.err)
		assert.Equal(t, tc.code, rec.Code, name)
		assert.JSONEq(t, tc.body, rec.Body.String(), name)
	}
}
