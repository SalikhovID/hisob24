package httpx

import (
	"encoding/json"
	"net/http"
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
