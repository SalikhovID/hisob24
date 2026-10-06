package app

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type roleJSON struct {
	ID           int64    `json:"id"`
	Name         string   `json:"name"`
	Permissions  []string `json:"permissions"`
	MembersCount int64    `json:"members_count"`
}

func toRoleJSON(r company.Role) roleJSON {
	perms := make([]string, 0, len(r.Permissions))
	for _, p := range r.Permissions {
		perms = append(perms, string(p))
	}
	return roleJSON{ID: r.ID, Name: r.Name, Permissions: perms, MembersCount: r.MembersCount}
}

// roleInputJSON is a role as the owner sends it: its name and permissions.
type roleInputJSON struct {
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

// The roles are the owner's alone (logic/roles.md, section 5): requireOwner
// stands before every handler here, so the session has a company.

// listRoles is the company's roles by name, each with how many members
// hold it.
func (h *Handler) listRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.companies.Roles(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	list := make([]roleJSON, 0, len(roles))
	for _, role := range roles {
		list = append(list, toRoleJSON(role))
	}
	httpx.JSON(w, http.StatusOK, list)
}

// createRole makes a role of the company.
func (h *Handler) createRole(w http.ResponseWriter, r *http.Request) {
	var body roleInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	role, err := h.companies.CreateRole(r.Context(), sessionCompany(r), body.Name, body.Permissions)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toRoleJSON(role))
}

// updateRole replaces the name and the permissions of the company's role.
func (h *Handler) updateRole(w http.ResponseWriter, r *http.Request) {
	var body roleInputJSON
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	role, err := h.companies.UpdateRole(r.Context(), sessionCompany(r), pathID(r, "id"), body.Name, body.Permissions)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toRoleJSON(role))
}

// deleteRole removes a role of the company that nobody holds.
func (h *Handler) deleteRole(w http.ResponseWriter, r *http.Request) {
	if err := h.companies.DeleteRole(r.Context(), sessionCompany(r), pathID(r, "id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// setEmployeeRole gives an employee of the company a role, or takes it
// away (null). The employee works by it from their next request on.
func (h *Handler) setEmployeeRole(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RoleID *int64 `json:"role_id"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	m, err := h.companies.SetEmployeeRole(r.Context(), sessionCompany(r), chi.URLParam(r, "phone"), body.RoleID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMemberJSON(m))
}
