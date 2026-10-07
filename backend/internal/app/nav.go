package app

import (
	"errors"
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// setNavOrder keeps the member's own order of the menu in the company the
// session works in (logic/roles.md, section 8), or drops it for the default
// (null), and answers /app/me with the order as it is now.
func (h *Handler) setNavOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Sections *[]string `json:"sections"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	var sections []string
	if body.Sections != nil {
		parsed, err := user.ParseNavOrder(*body.Sections)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		sections = parsed
	}
	claims := currentUser(r.Context())
	if err := h.profiles.SetNavOrder(r.Context(), claims.Phone, *claims.CompanyID, sections); err != nil {
		if errors.Is(err, user.ErrNotMember) {
			unauthorized(w)
			return
		}
		httpx.InternalError(w, r, err)
		return
	}
	// The standing in the context is from before the change.
	standing, err := h.profiles.Access(r.Context(), claims.Phone, *claims.CompanyID)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	me, err := h.meBody(r.Context(), claims, standing)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, me)
}
