package httpx_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/SalikhovID/hisob24/backend/internal/admin"
	"github.com/SalikhovID/hisob24/backend/internal/app"
	"github.com/SalikhovID/hisob24/backend/internal/bot/adminbot"
	"github.com/SalikhovID/hisob24/backend/internal/bot/userbot"
	"github.com/SalikhovID/hisob24/backend/internal/httpx"
)

// documentedRoutes lists openapi.yaml's operations as "METHOD /path".
func documentedRoutes(t *testing.T, file string) []string {
	t.Helper()
	raw, err := os.ReadFile(file)
	require.NoError(t, err)
	var doc struct {
		Paths map[string]map[string]any `yaml:"paths"`
	}
	require.NoError(t, yaml.Unmarshal(raw, &doc))
	var routes []string
	for path, item := range doc.Paths {
		for method := range item {
			switch method {
			case "get", "post", "put", "patch", "delete":
				routes = append(routes, strings.ToUpper(method)+" "+path)
			}
		}
	}
	return routes
}

// openapi.yaml is the API contract: the router serves what it lists, and
// nothing it does not.
func TestRouterServesExactlyTheDocumentedAPI(t *testing.T) {
	nop := func(http.ResponseWriter, *http.Request) {}
	router := httpx.NewRouter(
		admin.NewHandler(admin.Services{}, false, nil).Routes,
		app.NewHandler(app.Services{}, false, nil, nil).Routes,
		// cmd/api mounts these in BOT_MODE=webhook.
		func(r chi.Router) {
			r.Post(adminbot.WebhookPath, nop)
			r.Post(userbot.WebhookPath, nop)
		},
	)
	routes, ok := router.(chi.Routes)
	require.True(t, ok)

	var served []string
	require.NoError(t, chi.Walk(routes, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		served = append(served, method+" "+route)
		return nil
	}))

	assert.ElementsMatch(t, documentedRoutes(t, "../../openapi.yaml"), served)
}
