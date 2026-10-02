package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// NewRouter builds the API router: /healthz plus every mounted feature.
func NewRouter(mounts ...func(chi.Router)) http.Handler {
	r := chi.NewRouter()
	r.Get("/healthz", healthz)
	for _, mount := range mounts {
		mount(r)
	}
	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
