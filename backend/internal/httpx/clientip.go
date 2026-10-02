package httpx

import (
	"net/http"
	"net/netip"
	"strings"
)

// ClientIP is the address rate limits key on. The API sits behind proxies
// (Next.js rewrites, nginx in production), so a request from a loopback or
// private address is a proxy hop and the client is the rightmost
// X-Forwarded-For entry that is not one. Next.js passes the header on as it
// arrives, so this holds only when the outermost proxy appends the address
// it sees (nginx: $proxy_add_x_forwarded_for).
func ClientIP(r *http.Request) string {
	remote, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	addr := remote.Addr().Unmap()
	if !isProxy(addr) {
		return addr.String()
	}
	hops := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(hops) - 1; i >= 0; i-- {
		hop, err := netip.ParseAddr(strings.TrimSpace(hops[i]))
		if err != nil {
			break
		}
		if hop = hop.Unmap(); !isProxy(hop) {
			return hop.String()
		}
	}
	return addr.String()
}

func isProxy(a netip.Addr) bool { return a.IsLoopback() || a.IsPrivate() }
