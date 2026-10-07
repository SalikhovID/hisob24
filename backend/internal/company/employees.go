package company

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var (
	errAlreadyMember    = apperr.New(apperr.Conflict, "already_member", "Bu raqam kompaniyangizga allaqachon qo'shilgan")
	errOwnerProtected   = apperr.New(apperr.Conflict, "cannot_change_owner", "Kompaniya egasini o'zgartirib yoki o'chirib bo'lmaydi")
	errEmployeeNotFound = apperr.New(apperr.NotFound, "not_found", "Xodim topilmadi")
)

// Members lists the company's members under the names they go by there,
// each with the role they hold and the locations they may work in: the
// owner first, then the users in the order they joined.
func (s *Service) Members(ctx context.Context, companyID int64) ([]Member, error) {
	rows, err := s.q.ListCompanyUsers(ctx, companyID)
	if err != nil {
		return nil, err
	}
	restrictions, err := s.restrictions(ctx, companyID)
	if err != nil {
		return nil, err
	}
	members := make([]Member, 0, len(rows))
	for _, u := range rows {
		members = append(members, Member{
			Phone: u.Phone, FullName: u.FullName, Role: u.Role, RoleID: u.RoleID, RoleName: u.RoleName,
			AllLocations: u.AllLocations, Locations: restrictedTo(u.AllLocations, restrictions[u.Phone]), CreatedAt: u.CreatedAt,
		})
	}
	return members, nil
}

// AddEmployee adds the user with phone to the company as a user under
// fullName, in one transaction. A phone that is no user yet becomes one; a
// user of other companies gets one more, and stays as they are in the others.
func (s *Service) AddEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error) {
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
		if err := q.UpsertUser(ctx, gen.UpsertUserParams{Phone: normalized, FullName: &name}); err != nil {
			return err
		}
		uc, err := q.AddCompanyUser(ctx, gen.AddCompanyUserParams{UserPhone: normalized, CompanyID: companyID, Role: "user", FullName: &name})
		if errors.Is(err, pgx.ErrNoRows) {
			// A member already, the owner too: nothing changes, so the
			// owner is never made a user from the app.
			return errAlreadyMember
		}
		if err != nil {
			return err
		}
		// A new employee holds no role and works in every location.
		m = Member{Phone: uc.UserPhone, FullName: uc.FullName, Role: uc.Role, AllLocations: uc.AllLocations, CreatedAt: uc.CreatedAt}
		return nil
	})
	return m, err
}

// RenameEmployee changes the name a user goes by in the company; the names
// in their other companies stay, and so does the role they hold. The owner
// is not renamed from the app.
func (s *Service) RenameEmployee(ctx context.Context, companyID int64, phone, fullName string) (Member, error) {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, errEmployeeNotFound // no member has such a phone
	}
	name := strings.TrimSpace(fullName)
	if name == "" {
		return Member{}, invalid("Ismni kiriting")
	}
	_, err = s.q.RenameCompanyUser(ctx, gen.RenameCompanyUserParams{UserPhone: normalized, CompanyID: companyID, FullName: &name})
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, s.whyNotAnEmployee(ctx, companyID, normalized)
	}
	if err != nil {
		return Member{}, err
	}
	return s.member(ctx, companyID, normalized)
}

// member is one member of the company as the lists show them, with the
// name of the role they hold and the locations they may work in.
func (s *Service) member(ctx context.Context, companyID int64, phone string) (Member, error) {
	return memberIn(ctx, s.q, companyID, phone)
}

// memberIn reads one member with q, inside a transaction or not, so what a
// transaction wrote is what it answers with.
func memberIn(ctx context.Context, q *gen.Queries, companyID int64, phone string) (Member, error) {
	row, err := q.GetCompanyMember(ctx, gen.GetCompanyMemberParams{UserPhone: phone, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Member{}, errEmployeeNotFound // taken out between the two queries
	}
	if err != nil {
		return Member{}, err
	}
	m := Member{Phone: row.Phone, FullName: row.FullName, Role: row.Role, RoleID: row.RoleID, RoleName: row.RoleName, AllLocations: row.AllLocations, CreatedAt: row.CreatedAt}
	if !m.AllLocations {
		// A restricted member's locations are the live ones of the
		// restriction: what ListMemberLocations tells for them.
		rows, err := q.ListMemberLocations(ctx, gen.ListMemberLocationsParams{UserPhone: phone, CompanyID: companyID})
		if err != nil {
			return Member{}, err
		}
		m.Locations = make([]Location, 0, len(rows))
		for _, r := range rows {
			m.Locations = append(m.Locations, Location{ID: r.ID, Name: r.Name})
		}
	}
	return m, nil
}

// whyNotAnEmployee says why the app may not change the member with phone:
// the owner is out of its reach, anyone else is not in the company.
func (s *Service) whyNotAnEmployee(ctx context.Context, companyID int64, phone string) error {
	m, err := s.q.GetUserCompany(ctx, gen.GetUserCompanyParams{UserPhone: phone, CompanyID: companyID})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return errEmployeeNotFound
	case err != nil:
		return err
	case m.Role == "owner":
		return errOwnerProtected
	default:
		return errEmployeeNotFound // taken out between the two queries
	}
}

// RemoveEmployee takes a user out of the company. The user, their name and
// their other companies stay; with no company left they cannot sign in. The
// owner is not removed from the app.
func (s *Service) RemoveEmployee(ctx context.Context, companyID int64, phone string) error {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return errEmployeeNotFound // no member has such a phone
	}
	_, err = s.q.RemoveCompanyUser(ctx, gen.RemoveCompanyUserParams{UserPhone: normalized, CompanyID: companyID})
	if errors.Is(err, pgx.ErrNoRows) {
		return s.whyNotAnEmployee(ctx, companyID, normalized)
	}
	return err
}
