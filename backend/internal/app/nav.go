package app

import (
	"errors"
	"net/http"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
	"github.com/SalikhovID/hisob24/backend/internal/user"
)

// setTabBar keeps the member's own pages of the tab bar in the company the
// session works in (logic/roles.md, section 8), or drops them for the
// default (null), and answers /app/me with the bar as it is now.
func (h *Handler) setTabBar(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Pages *[]string `json:"pages"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	var pages []string
	if body.Pages != nil {
		parsed, err := user.ParseTabBar(*body.Pages)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		pages = parsed
	}
	claims := currentUser(r.Context())
	if err := h.profiles.SetTabBar(r.Context(), claims.Phone, *claims.CompanyID, pages); err != nil {
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
