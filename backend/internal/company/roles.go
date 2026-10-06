package company

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/SalikhovID/hisob24/backend/internal/access"
	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/fields"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

var (
	errRoleNameTaken = apperr.New(apperr.Conflict, "name_taken", "Bu nomli rol allaqachon bor")
	errRoleNotFound  = apperr.New(apperr.NotFound, "not_found", "Rol topilmadi")
)

// Role is a company role: a name and the permissions it holds (in the
// catalog's order), with how many members hold it (logic/roles.md, section
// 5). The owner makes them and gives them to employees.
type Role struct {
	ID           int64
	Name         string
	Permissions  []access.Permission
	MembersCount int64
}

func toRole(id int64, name string, permissions []string, members int64) Role {
	perms := make([]access.Permission, 0, len(permissions))
	for _, p := range permissions {
		perms = append(perms, access.Permission(p))
	}
	return Role{ID: id, Name: name, Permissions: perms, MembersCount: members}
}

// Roles lists the company's roles by name, each with how many members hold it.
func (s *Service) Roles(ctx context.Context, companyID int64) ([]Role, error) {
	rows, err := s.q.ListRoles(ctx, companyID)
	if err != nil {
		return nil, err
	}
	roles := make([]Role, 0, len(rows))
	for _, r := range rows {
		roles = append(roles, toRole(r.ID, r.Name, r.Permissions, r.MembersCount))
	}
	return roles, nil
}

// roleInput is a role's name and permissions as they are kept: the name
// trimmed and within its length, the permissions from the catalog, each
// once, in its order, an action only with its section's view.
func roleInput(name string, permissions []string) (string, []string, error) {
	cleaned, err := fields.CleanName(name)
	if err != nil {
		return "", nil, err
	}
	parsed, err := access.Parse(permissions)
	if err != nil {
		return "", nil, err
	}
	keys := make([]string, 0, len(parsed))
	for _, p := range parsed {
		keys = append(keys, string(p))
	}
	return cleaned, keys, nil
}

// CreateRole makes a role of the company. Its name is one role's in the
// company, whatever the case.
func (s *Service) CreateRole(ctx context.Context, companyID int64, name string, permissions []string) (Role, error) {
	cleaned, keys, err := roleInput(name, permissions)
	if err != nil {
		return Role{}, err
	}
	r, err := s.q.CreateRole(ctx, gen.CreateRoleParams{CompanyID: companyID, Name: cleaned, Permissions: keys})
	if fields.Taken(err) {
		return Role{}, errRoleNameTaken
	}
	if err != nil {
		return Role{}, err
	}
	return toRole(r.ID, r.Name, r.Permissions, 0), nil
}

// UpdateRole replaces the name and the permissions of the company's role.
// The members who hold it work by the new permissions from their next
// request on.
func (s *Service) UpdateRole(ctx context.Context, companyID, id int64, name string, permissions []string) (Role, error) {
	cleaned, keys, err := roleInput(name, permissions)
	if err != nil {
		return Role{}, err
	}
	var role Role
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		_, err := q.UpdateRole(ctx, gen.UpdateRoleParams{ID: id, CompanyID: companyID, Name: cleaned, Permissions: keys})
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return errRoleNotFound
		case fields.Taken(err):
			return errRoleNameTaken
		case err != nil:
			return err
		}
		r, err := q.GetRole(ctx, gen.GetRoleParams{ID: id, CompanyID: companyID})
		if err != nil {
			return err
		}
		role = toRole(r.ID, r.Name, r.Permissions, r.MembersCount)
		return nil
	})
	return role, err
}

// DeleteRole removes the company's role for good; its name is free again.
// A role someone holds is not deleted.
func (s *Service) DeleteRole(ctx context.Context, companyID, id int64) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		r, err := q.GetRole(ctx, gen.GetRoleParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errRoleNotFound
		}
		if err != nil {
			return err
		}
		if r.MembersCount > 0 {
			return apperr.New(apperr.Conflict, "role_in_use", fmt.Sprintf("Bu rol %d ta xodimga biriktirilgan", r.MembersCount))
		}
		_, err = q.DeleteRole(ctx, gen.DeleteRoleParams{ID: id, CompanyID: companyID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errRoleNotFound // deleted between the two queries
		}
		return err
	})
}

// SetEmployeeRole gives a user of the company one of its roles, or takes
// the role away (nil). The owner holds no role; the role has to be the
// company's own.
func (s *Service) SetEmployeeRole(ctx context.Context, companyID int64, phone string, roleID *int64) (Member, error) {
	normalized, err := user.NormalizePhone(phone)
	if err != nil {
		return Member{}, errEmployeeNotFound // no member has such a phone
	}
	var m Member
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if roleID != nil {
			if _, err := q.GetRole(ctx, gen.GetRoleParams{ID: *roleID, CompanyID: companyID}); err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return errRoleNotFound
				}
				return err
			}
		}
		_, err := q.SetCompanyUserRole(ctx, gen.SetCompanyUserRoleParams{UserPhone: normalized, CompanyID: companyID, RoleID: roleID})
		if errors.Is(err, pgx.ErrNoRows) {
			return s.whyNotAnEmployee(ctx, companyID, normalized)
		}
		if err != nil {
			return err
		}
		row, err := q.GetCompanyMember(ctx, gen.GetCompanyMemberParams{UserPhone: normalized, CompanyID: companyID})
		if err != nil {
			return err
		}
		m = Member{Phone: row.Phone, FullName: row.FullName, Role: row.Role, RoleID: row.RoleID, RoleName: row.RoleName, CreatedAt: row.CreatedAt}
		return nil
	})
	return m, err
}
