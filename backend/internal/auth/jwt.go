package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessTokenTTL is how long a user app access token lives.
const AccessTokenTTL = 15 * time.Minute

// ErrInvalidAccessToken is an access token that is not ours, not for the
// user app or no longer valid.
var ErrInvalidAccessToken = errors.New("invalid access token")

// AccessClaims is what a user app access token says: whose it is and, once
// one is chosen, the company and the role there.
type AccessClaims struct {
	Phone     string
	CompanyID *int64
	Role      string
}

// accessClaims is the token's payload. aud is a plain string, as the spec
// writes it (aud = "app"), not jwt.RegisteredClaims' list.
type accessClaims struct {
	Subject   string           `json:"sub"`
	Audience  string           `json:"aud"`
	IssuedAt  *jwt.NumericDate `json:"iat"`
	ExpiresAt *jwt.NumericDate `json:"exp,omitempty"`
	CompanyID *int64           `json:"company_id,omitempty"`
	Role      string           `json:"role,omitempty"`
}

func (c accessClaims) GetExpirationTime() (*jwt.NumericDate, error) { return c.ExpiresAt, nil }
func (c accessClaims) GetIssuedAt() (*jwt.NumericDate, error)       { return c.IssuedAt, nil }
func (c accessClaims) GetNotBefore() (*jwt.NumericDate, error)      { return nil, nil }
func (c accessClaims) GetIssuer() (string, error)                   { return "", nil }
func (c accessClaims) GetSubject() (string, error)                  { return c.Subject, nil }
func (c accessClaims) GetAudience() (jwt.ClaimStrings, error)       { return jwt.ClaimStrings{c.Audience}, nil }

// IssueAccessToken signs an access token for claims, valid from now for
// AccessTokenTTL, and returns it with its expiry.
func IssueAccessToken(secret []byte, claims AccessClaims, now time.Time) (string, time.Time, error) {
	expires := now.Add(AccessTokenTTL)
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims{
		Subject:   claims.Phone,
		Audience:  "app",
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(expires),
		CompanyID: claims.CompanyID,
		Role:      claims.Role,
	}).SignedString(secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expires, nil
}

// ParseAccessToken checks an access token and returns its claims.
func ParseAccessToken(secret []byte, token string, now time.Time) (AccessClaims, error) {
	var claims accessClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return secret, nil },
		jwt.WithTimeFunc(func() time.Time { return now }),
	)
	if err != nil {
		return AccessClaims{}, fmt.Errorf("%w: %w", ErrInvalidAccessToken, err)
	}
	return AccessClaims{Phone: claims.Subject, CompanyID: claims.CompanyID, Role: claims.Role}, nil
}
