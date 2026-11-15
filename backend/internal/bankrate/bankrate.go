// Package bankrate takes the day's currency rates from the banks of
// Uzbekistan (logic/currencies.md, section 4), the way tw-dobroe's bankapi
// does: the central bank's official rates, and six banks' selling rates
// read from their own pages or the valyutalarkursi.uz aggregator.
package bankrate

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

// userAgent is what every request says it is: a page answers it as it
// answers a browser.
const userAgent = "Mozilla/5.0 (compatible; RateFetcher/1.0)"

// maxBody is the most of an answer read: a bank's page is under a megabyte.
const maxBody = 8 << 20

// Rates is a bank's rates in so'm for one unit; 0 for a currency it gave
// none for.
type Rates struct {
	USD, EUR, RUB float64
}

// URLs are where the rates are read; a test points them at a server of its
// own.
type URLs struct {
	CBU string
}

// Client reads the banks' rates.
type Client struct {
	HTTP *http.Client
	URLs URLs
}

// get is the body of the answer to a GET of the URL; anything but 200 is an
// error.
func (c *Client) get(ctx context.Context, url, accept string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", accept)
	req.Header.Set("Accept-Language", "uz,ru,en;q=0.9")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, maxBody))
}
