package auth

import (
	"context"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// ListAdmins returns every admin, active or not.
func (a *AdminAuth) ListAdmins(ctx context.Context) ([]gen.Admin, error) {
	return a.q.ListAdmins(ctx)
}
