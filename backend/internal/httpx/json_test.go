package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestJSON(t *testing.T) {
	rec := httptest.NewRecorder()

	JSON(rec, http.StatusCreated, map[string]int{"id": 7})

	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"id":7}`, rec.Body.String())
}

func TestError(t *testing.T) {
	rec := httptest.NewRecorder()

	Error(rec, http.StatusTooManyRequests, "too_many_requests", "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring")

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.JSONEq(t,
		`{"error":"too_many_requests","message":"Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring"}`,
		rec.Body.String())
}
