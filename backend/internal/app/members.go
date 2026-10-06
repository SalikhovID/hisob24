package app

import (
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// listMembers is the members of the company the session works in, for every
// member of it: a task's assignee is chosen among them. Managing them is the
// owner's (/app/employees).
func (h *Handler) listMembers(w http.ResponseWriter, r *http.Request) {
	members, err := h.companies.Members(r.Context(), sessionCompany(r))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	body := make([]memberJSON, 0, len(members))
	for _, m := range members {
		body = append(body, toMemberJSON(m))
	}
	httpx.JSON(w, http.StatusOK, body)
}
