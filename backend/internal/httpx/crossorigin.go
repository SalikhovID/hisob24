package httpx

import (
	"fmt"
	"net/http"
	"net/url"
)

// CrossOriginGuard refuses state-changing requests (POST, PATCH, DELETE…)
// that a browser sent from another site; the Mini App's SameSite=None
// cookie would ride along with them. Modern browsers say where a request
// comes from in Sec-Fetch-Site, older ones are judged by Origin.
// trustedOrigins are the panels' URLs: behind the Next.js rewrite, Origin
// never matches the API's own host. Requests without these headers (curl,
// Telegram's webhooks) pass.
func CrossOriginGuard(trustedOrigins ...string) (func(http.Handler) http.Handler, error) {
	cop := http.NewCrossOriginProtection()
	for _, raw := range trustedOrigins {
		if raw == "" {
			continue
		}
		u, err := url.Parse(raw)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return nil, fmt.Errorf("trusted origin %q is not a URL", raw)
		}
		if err := cop.AddTrustedOrigin(u.Scheme + "://" + u.Host); err != nil {
			return nil, err
		}
	}
	cop.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		Error(w, http.StatusForbidden, "forbidden", "Boshqa saytdan kelgan so'rov rad etildi")
	}))
	return cop.Handler, nil
}
