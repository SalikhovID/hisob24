package httpx

import (
	"net/http"
	"net/netip"
)

// ClientIP is the address rate limits key on.
func ClientIP(r *http.Request) string {
	remote, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return remote.Addr().Unmap().String()
}
