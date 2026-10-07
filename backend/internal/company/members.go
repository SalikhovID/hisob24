package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// ReplaceOwner makes the user with phone the company's owner under fullName,
// in one transaction; the owner before stays in the company as a user. A
// phone that is no user yet becomes one; the owner's own phone only gets the
// new name. A restriction to some locations the new owner held as a user is
// lifted: the owner works in every location.
func (s *Service) ReplaceOwner(ctx context.Context, companyID int64, phone, fullName string) (Member, error) {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, invalid("Telefon raqami noto'g'ri")
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return Member{}, invalid("Ismni kiriting")
	}

	var m Member
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// The company is held to the end, so two replacements take turns:
		// the second demotes the owner the first one set.
		if _, err := q.LockCompany(ctx, companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errNotFound
			}
			return err
		}
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
			return err
		}
		if err := q.DemoteCompanyOwner(ctx, companyID); err != nil {
			return err
		}
		owner, err := q.SetCompanyOwner(ctx, gen.SetCompanyOwnerParams{UserPhone: normalized, CompanyID: companyID, FullName: &name})
		if err != nil {
			return err
		}
		// The owner works in every location: a restriction held as a user
		// is lifted (SetCompanyOwner raised all_locations).
		if err := q.DeleteMemberLocations(ctx, gen.DeleteMemberLocationsParams{UserPhone: normalized, CompanyID: companyID}); err != nil {
			return err
		}
		m = Member{Phone: owner.UserPhone, FullName: owner.FullName, Role: owner.Role, AllLocations: owner.AllLocations, CreatedAt: owner.CreatedAt}
		return nil
	})
	return m, err
}
