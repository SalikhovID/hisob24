package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

const (
	loginCodeTTL   = 60 * time.Second
	loginCodeDraws = 5
)

var (
	// ErrNotAdmin means the Telegram user is not an active admin.
	ErrNotAdmin = errors.New("not an active admin")
	// ErrInvalidCode means a wrong, used or expired login code.
	ErrInvalidCode = errors.New("invalid login code")
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
		// The hash of another admin's live code is taken (unique index): draw
		// again, inside a savepoint so the transaction survives the failure.
		for range loginCodeDraws {
			code, err := a.newCode()
			if err != nil {
				return err
			}
			var id int64
			err = pgx.BeginFunc(ctx, tx, func(sp pgx.Tx) error {
				var err error
				id, err = a.q.WithTx(sp).CreateAdminLoginCode(ctx, gen.CreateAdminLoginCodeParams{
					AdminID:   telegramID,
					CodeHash:  HashCode(a.secret, code),
					ExpiresAt: a.now().Add(loginCodeTTL),
				})
				return err
			})
			if isUniqueViolation(err) {
				continue
			}
			if err != nil {
				return err
			}
			issued = LoginCode{ID: id, Code: code}
			return nil
		}
		return fmt.Errorf("no free login code after %d draws", loginCodeDraws)
	})
	return issued, err
}

// LoginWithCode spends a code from the admin bot and opens a session.
// ErrInvalidCode for a wrong, used or expired code and for an admin who was
// deactivated after the code went out.
func (a *AdminAuth) LoginWithCode(ctx context.Context, code string) (Session, error) {
	var s Session
	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		adminID, err := q.ConsumeAdminLoginCode(ctx, HashCode(a.secret, code))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidCode
		}
		if err != nil {
			return err
		}
		s, err = a.openSession(ctx, q, adminID, "otp")
		if errors.Is(err, ErrNotAdmin) {
			return ErrInvalidCode
		}
		return err
	})
	return s, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
