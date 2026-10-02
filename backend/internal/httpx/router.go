package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// NewRouter builds the API router.
func NewRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/healthz", healthz)
	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
