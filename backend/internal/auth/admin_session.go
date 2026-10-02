package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

const (
	adminSessionTTL = 12 * time.Hour
	initDataMaxAge  = 24 * time.Hour
)

// Session is an open admin session; ID is the admin_session cookie value.
type Session struct {
	ID        uuid.UUID
	ExpiresAt time.Time
	Admin     gen.Admin
}

// openSession starts an adminSessionTTL session for an active admin;
// ErrNotAdmin otherwise. source is "otp" or "miniapp".
func (a *AdminAuth) openSession(ctx context.Context, q *gen.Queries, adminID int64, source string) (Session, error) {
	admin, err := q.GetActiveAdmin(ctx, adminID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotAdmin
	}
	if err != nil {
		return Session{}, err
	}
	row, err := q.CreateAdminSession(ctx, gen.CreateAdminSessionParams{
		AdminID:   adminID,
		Source:    source,
		ExpiresAt: a.now().Add(adminSessionTTL),
	})
	if err != nil {
		return Session{}, err
	}
	return Session{ID: row.ID, ExpiresAt: row.ExpiresAt, Admin: admin}, nil
}

// LoginWithInitData opens a session for the admin who opened the Mini App.
// ErrInvalidInitData (or ErrInitDataExpired) unless the admin bot signed it in
// the last day; ErrNotAdmin unless its user is an active admin.
func (a *AdminAuth) LoginWithInitData(ctx context.Context, initData string) (Session, error) {
	user, err := ValidateInitData(initData, a.botToken, initDataMaxAge, a.now())
	if err != nil {
		return Session{}, err
	}
	return a.openSession(ctx, a.q, user.ID, "miniapp")
}

// ErrUnauthenticated means no live session stands behind the cookie.
var ErrUnauthenticated = errors.New("no live admin session")

// Authenticate returns the admin behind a session cookie value;
// ErrUnauthenticated for a malformed, unknown or expired session and for a
// deactivated admin.
func (a *AdminAuth) Authenticate(ctx context.Context, sessionID string) (gen.Admin, error) {
	id, err := uuid.Parse(sessionID)
	if err != nil {
		return gen.Admin{}, ErrUnauthenticated
	}
	admin, err := a.q.GetAdminBySession(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.Admin{}, ErrUnauthenticated
	}
	return admin, err
}
