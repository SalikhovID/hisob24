// Package apperr carries refusals from the services to the API: what kind
// of refusal it is, a snake_case code and the Uzbek message the client shows.
package apperr

// Kind decides the HTTP status a refusal maps to.
type Kind int

const (
	// Invalid is a request that breaks a rule (400).
	Invalid Kind = iota + 1
	// NotFound is a missing resource (404).
	NotFound
	// Conflict clashes with the current state (409).
	Conflict
)

// Error is a refusal the client should see.
type Error struct {
	Kind    Kind
	Code    string
	Message string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

// New builds a refusal.
func New(kind Kind, code, message string) *Error {
	return &Error{Kind: kind, Code: code, Message: message}
}
