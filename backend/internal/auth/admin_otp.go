package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// AdminAuth logs platform admins in with codes from the admin bot or with
// Mini App initData, and keeps the sessions both open.
type AdminAuth struct {
	pool     *pgxpool.Pool
	q        *gen.Queries
	secret   []byte // OTP_HMAC_SECRET
	botToken string // ADMIN_BOT_TOKEN, signs Mini App initData
	now      func() time.Time
	newCode  func() (string, error)
}

// NewAdminAuth wires the service; botToken may be empty when the bot is off.
func NewAdminAuth(pool *pgxpool.Pool, otpSecret, botToken string) *AdminAuth {
	return &AdminAuth{
		pool:     pool,
		q:        gen.New(pool),
		secret:   []byte(otpSecret),
		botToken: botToken,
		now:      time.Now,
		newCode:  func() (string, error) { return NewCode(rand.Reader) },
	}
}

// IsActiveAdmin reports whether telegramID belongs to an active admin.
func (a *AdminAuth) IsActiveAdmin(ctx context.Context, telegramID int64) (bool, error) {
	_, err := a.q.GetActiveAdmin(ctx, telegramID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
