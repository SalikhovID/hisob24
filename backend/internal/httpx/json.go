// Package httpx holds the HTTP router and the JSON response helpers.
package httpx

import (
	"encoding/json"
	"net/http"
)

// JSON writes v as the JSON response body with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ErrorBody is the API error format from the spec:
// {"error": "<snake_case code>", "message": "<Uzbek text>"}.
type ErrorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Error writes an API error with the given status, code and Uzbek message.
func Error(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorBody{Error: code, Message: message})
}
