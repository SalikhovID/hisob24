package app

import (
	"net/http"
	"time"

	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

type memberJSON struct {
	Phone     string    `json:"phone"`
	FullName  *string   `json:"full_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// listEmployees is the members of the company the owner works in.
func (h *Handler) listEmployees(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, []memberJSON{})
}
