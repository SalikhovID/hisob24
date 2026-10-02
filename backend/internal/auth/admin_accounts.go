package auth

import (
	"context"
	"errors"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// ListAdmins returns every admin, active or not.
func (a *AdminAuth) ListAdmins(ctx context.Context) ([]gen.Admin, error) {
	return a.q.ListAdmins(ctx)
}

// AddAdmin adds an admin, or reactivates a deactivated one with the new
// name. An active admin with that Telegram ID is a conflict.
func (a *AdminAuth) AddAdmin(ctx context.Context, telegramID int64, fullName string) (gen.Admin, error) {
	if telegramID <= 0 {
		return gen.Admin{}, apperr.New(apperr.Invalid, "validation_error", "Telegram ID noto'g'ri")
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return gen.Admin{}, apperr.New(apperr.Invalid, "validation_error", "Adminning ismini kiriting")
	}
	admin, err := a.q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: telegramID, FullName: &name})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.Admin{}, apperr.New(apperr.Conflict, "admin_exists", "Bu admin allaqachon faol")
	}
	return admin, err
}

// DeactivateAdmin turns an admin off and ends their sessions. Admins cannot
// turn themselves off, and the last active admin stays: the active rows are
// locked, so two admins turning each other off cannot both win.
func (a *AdminAuth) DeactivateAdmin(ctx context.Context, actorID, telegramID int64) error {
	if actorID == telegramID {
		return apperr.New(apperr.Conflict, "cannot_delete_self", "O'zingizni o'chira olmaysiz")
	}
	return pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		q := a.q.WithTx(tx)
		active, err := q.LockActiveAdmins(ctx)
		if err != nil {
			return err
		}
		if !slices.Contains(active, telegramID) {
			return apperr.New(apperr.NotFound, "not_found", "Faol admin topilmadi")
		}
		if len(active) == 1 {
			return apperr.New(apperr.Conflict, "last_admin", "Kamida bitta faol admin qolishi kerak")
		}
		if _, err := q.DeactivateAdmin(ctx, telegramID); err != nil {
			return err
		}
		return q.DeleteAdminSessionsByAdmin(ctx, telegramID)
	})
}
