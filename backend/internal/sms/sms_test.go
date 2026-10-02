package sms

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// The text has to match the template approved in the Eskiz account.
func TestText(t *testing.T) {
	assert.Equal(t, "Hisob24 kirish kodi: 123456", Text("123456"))
}
