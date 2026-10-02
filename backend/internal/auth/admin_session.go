package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

const adminSessionTTL = 12 * time.Hour

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
