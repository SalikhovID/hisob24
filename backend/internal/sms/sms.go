// Package sms sends the user app's login codes: to the log in development,
// through Eskiz.uz in production.
package sms

import "context"

// Sender delivers a text to a phone (digits only, 998XXXXXXXXX).
type Sender interface {
	Send(ctx context.Context, phone, text string) error
}

// Text is the login code SMS. Eskiz sends only texts that match a template
// approved in the account, so this one has to be registered there.
func Text(code string) string {
	return "Hisob24 kirish kodi: " + code
}
