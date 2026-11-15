//go:build integration

package bankrate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestAllBanksLive asks every bank for its rates now, each the way its
// pages allow, without the central bank to fall back on: whether the pages
// still read the way the code reads them.
//
//	go test -tags=integration -run TestAllBanksLive -v ./internal/bankrate
func TestAllBanksLive(t *testing.T) {
	c := New()
	for _, source := range []string{CBU, Kapital, IpakYuli, Asaka, Hamkor, Uzum, OFB} {
		t.Run(source, func(t *testing.T) {
			r, err := c.one(t.Context(), source)
			if err != nil {
				t.Errorf("%s: %v", source, err)
				return
			}
			t.Logf("%s: USD %.2f, EUR %.2f, RUB %.2f", source, r.USD, r.EUR, r.RUB)
			assert.True(t, r.USD >= 8000 && r.USD <= 20000, "USD %.2f", r.USD)
			assert.True(t, r.EUR >= 9000 && r.EUR <= 22000, "EUR %.2f", r.EUR)
			assert.True(t, r.RUB == 0 || (r.RUB >= 80 && r.RUB <= 300), "RUB %.2f", r.RUB)
		})
	}
}
