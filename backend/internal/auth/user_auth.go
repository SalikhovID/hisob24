package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/sms"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

const (
	// RefreshTokenTTL is how long a user app refresh token lives.
	RefreshTokenTTL = 30 * 24 * time.Hour
	smsCodeTTL      = 2 * time.Minute
	smsCooldown     = 60 // seconds between two codes to one phone
)

// ErrTooSoon refuses a second code to a phone within a minute.
var ErrTooSoon = errors.New("a code went to this phone less than a minute ago")

var errBadPhone = apperr.New(apperr.Invalid, "validation_error", "Telefon raqami noto'g'ri")

// UserAuth signs users in to the user app: a code by SMS, then an access
// token and a refresh token that renews it.
type UserAuth struct {
	pool            *pgxpool.Pool
	q               *gen.Queries
	otpSecret       []byte
	jwtSecret       []byte
	sender          sms.Sender
	now             func() time.Time
	newCode         func() (string, error)
	newRefreshToken func() (string, error)
}

// NewUserAuth wires the user app's sign-in. Codes are stored as HMACs with
// otpSecret; access tokens are signed with jwtSecret.
func NewUserAuth(pool *pgxpool.Pool, otpSecret, jwtSecret string, sender sms.Sender) *UserAuth {
	return &UserAuth{
		pool:      pool,
		q:         gen.New(pool),
		otpSecret: []byte(otpSecret),
		jwtSecret: []byte(jwtSecret),
		sender:    sender,
		now:       time.Now,
		newCode:   func() (string, error) { return NewCode(rand.Reader) },
	}
}

// SendCode texts a login code to phone, valid for two minutes; only its
// HMAC is stored.
func (a *UserAuth) SendCode(ctx context.Context, rawPhone string) error {
	phone, err := user.NormalizePhone(rawPhone)
	if err != nil {
		return errBadPhone
	}
	code, err := a.newCode()
	if err != nil {
		return err
	}
	stored, err := a.q.UpsertSMSCode(ctx, gen.UpsertSMSCodeParams{
		Phone:           phone,
		CodeHash:        HashCode(a.otpSecret, code),
		ExpiresAt:       a.now().Add(smsCodeTTL),
		CooldownSeconds: smsCooldown,
	})
	if err != nil {
		return err
	}
	if stored == 0 {
		return ErrTooSoon
	}
	// A phone that is not a user gets no SMS, but the same answer and a
	// code nobody will see: the replies tell nothing about who signs up.
	known, err := a.q.UserExists(ctx, phone)
	if err != nil {
		return err
	}
	if !known {
		return nil
	}
	if err := a.sender.Send(ctx, phone, sms.Text(code)); err != nil {
		// The SMS never left: no minute to wait before asking again.
		if dropErr := a.q.DeleteSMSCode(ctx, phone); dropErr != nil {
			return errors.Join(fmt.Errorf("send sms: %w", err), dropErr)
		}
		return fmt.Errorf("send sms: %w", err)
	}
	return nil
}
