package admin

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

func (h *Handler) listAdmins(w http.ResponseWriter, r *http.Request) {
	admins, err := h.auth.ListAdmins(r.Context())
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	items := make([]adminAccountJSON, 0, len(admins))
	for _, a := range admins {
		items = append(items, toAdminAccountJSON(a))
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) addAdmin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TelegramID int64  `json:"telegram_id"`
		FullName   string `json:"full_name"`
	}
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	a, err := h.auth.AddAdmin(r.Context(), body.TelegramID, body.FullName)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toAdminAccountJSON(a))
}

// deleteAdmin deactivates the admin; the row stays for created_by.
func (h *Handler) deleteAdmin(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "telegram_id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "Faol admin topilmadi")
		return
	}
	if err := h.auth.DeactivateAdmin(r.Context(), currentAdmin(r.Context()).TelegramID, id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
