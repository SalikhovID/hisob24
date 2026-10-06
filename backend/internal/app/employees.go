package app

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/company"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type memberJSON struct {
	Phone    string  `json:"phone"`
	FullName *string `json:"full_name"`
	Role     string  `json:"role"`
	// RoleID and RoleName are the company role the member holds, null for
	// the owner and for a user without one.
	RoleID    *int64    `json:"role_id"`
	RoleName  *string   `json:"role_name"`
	CreatedAt time.Time `json:"created_at"`
}

func toMemberJSON(m company.Member) memberJSON {
	return memberJSON{Phone: m.Phone, FullName: m.FullName, Role: m.Role, RoleID: m.RoleID, RoleName: m.RoleName, CreatedAt: m.CreatedAt}
}

// sessionCompany is the company the request acts on: always the one the
// access token is for, never one named in the request. requireOwner or
// requireCompany has let the request through, so there is one.
func sessionCompany(r *http.Request) int64 {
	return *currentUser(r.Context()).CompanyID
}

// listEmployees is the members of the company the owner works in.
func (h *Handler) listEmployees(w http.ResponseWriter, r *http.Request) {
	members, err := h.companies.Members(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	list := make([]memberJSON, 0, len(members))
	for _, m := range members {
		list = append(list, toMemberJSON(m))
	}
	httpx.JSON(w, http.StatusOK, list)
}

// addEmployee adds a phone to the owner's company as a user. A phone that
// works in another company gets the answer a new one does.
func (h *Handler) addEmployee(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone    string `json:"phone"`
		FullName string `json:"full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	m, err := h.companies.AddEmployee(r.Context(), sessionCompany(r), body.Phone, body.FullName)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toMemberJSON(m))
}

// renameEmployee changes the name an employee goes by in the owner's company.
func (h *Handler) renameEmployee(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FullName string `json:"full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	m, err := h.companies.RenameEmployee(r.Context(), sessionCompany(r), chi.URLParam(r, "phone"), body.FullName)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toMemberJSON(m))
}

// removeEmployee takes an employee out of the owner's company. From their
// next request on requireAccess turns them away from it.
func (h *Handler) removeEmployee(w http.ResponseWriter, r *http.Request) {
	if err := h.companies.RemoveEmployee(r.Context(), sessionCompany(r), chi.URLParam(r, "phone")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
