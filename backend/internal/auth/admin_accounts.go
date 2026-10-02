package auth

import (
	"context"
	"errors"
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
	name := strings.TrimSpace(fullName)
	admin, err := a.q.CreateOrReactivateAdmin(ctx, gen.CreateOrReactivateAdminParams{TelegramID: telegramID, FullName: &name})
	if errors.Is(err, pgx.ErrNoRows) {
		return gen.Admin{}, apperr.New(apperr.Conflict, "admin_exists", "Bu admin allaqachon faol")
	}
	return admin, err
}
