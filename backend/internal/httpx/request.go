package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
)

// DecodeJSON reads a JSON request body into v. On a malformed body it answers
// 400 and returns false.
func DecodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v); err != nil {
		Error(w, http.StatusBadRequest, "bad_request", "So'rov noto'g'ri")
		return false
	}
	return true
}

// InternalError logs err and answers 500 without exposing it.
func InternalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.ErrorContext(r.Context(), "request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	Error(w, http.StatusInternalServerError, "internal_error", "Ichki xatolik. Birozdan keyin qayta urinib ko'ring")
}

// WriteError answers err: an *apperr.Error with its status, code and
// message, anything else with a logged 500.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var e *apperr.Error
	if !errors.As(err, &e) {
		InternalError(w, r, err)
		return
	}
	status := map[apperr.Kind]int{
		apperr.Invalid:  http.StatusBadRequest,
		apperr.NotFound: http.StatusNotFound,
		apperr.Conflict: http.StatusConflict,
	}[e.Kind]
	if status == 0 {
		InternalError(w, r, err)
		return
	}
	Error(w, status, e.Code, e.Message)
}
