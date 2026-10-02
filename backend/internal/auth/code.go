// Package auth logs people in: platform admins (bot codes, Mini App initData,
// sessions) and, later, company users.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"math/big"
)

// NewCode draws a 6-digit one-time code, 000000-999999, from r
// (crypto/rand.Reader outside tests).
func NewCode(r io.Reader) (string, error) {
	n, err := rand.Int(r, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("draw code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HashCode is the form a one-time code is stored in:
// hex(HMAC-SHA256(code, secret)).
func HashCode(secret []byte, code string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
}
