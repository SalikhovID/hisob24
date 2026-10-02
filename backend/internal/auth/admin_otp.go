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

const loginCodeTTL = 60 * time.Second

// ErrNotAdmin means the Telegram user is not an active admin.
var ErrNotAdmin = errors.New("not an active admin")

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

// LoginCode is a code for the admin bot to send; ID discards it when the
// message cannot be delivered.
type LoginCode struct {
	ID   int64
	Code string
}

// IssueLoginCode replaces the admin's unused codes with a new one that lives
// loginCodeTTL; expired codes of every admin go too. ErrNotAdmin when
// telegramID is not an active admin.
func (a *AdminAuth) IssueLoginCode(ctx context.Context, telegramID int64) (LoginCode, error) {
	var issued LoginCode
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		if _, err := q.GetActiveAdmin(ctx, telegramID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotAdmin
			}
			return err
		}
		if err := q.DeleteStaleAdminLoginCodes(ctx, telegramID); err != nil {
			return err
		}
		code, err := a.newCode()
		if err != nil {
			return err
		}
		id, err := q.CreateAdminLoginCode(ctx, gen.CreateAdminLoginCodeParams{
			AdminID:   telegramID,
			CodeHash:  HashCode(a.secret, code),
			ExpiresAt: a.now().Add(loginCodeTTL),
		})
		if err != nil {
			return err
		}
		issued = LoginCode{ID: id, Code: code}
		return nil
	})
	return issued, err
}
