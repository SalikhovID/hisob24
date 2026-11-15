// Package bankrate takes the day's currency rates from the banks of
// Uzbekistan (logic/currencies.md, section 4), the way tw-dobroe's bankapi
// does: the central bank's official rates, and six banks' selling rates
// read from their own pages or the valyutalarkursi.uz aggregator.
package bankrate

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
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
	CBU, Aggregator                             string
	Kapital, IpakYuli, Asaka, Hamkor, Uzum, OFB string
}

// The sources a company may take its rates from (companies.rate_source,
// apart from "manual").
const (
	CBU      = "cbu"
	Kapital  = "kapitalbank"
	IpakYuli = "ipakyuli"
	Asaka    = "asaka"
	Hamkor   = "hamkor"
	Uzum     = "uzum"
	OFB      = "ofb"
)

// Client reads the banks' rates.
type Client struct {
	HTTP *http.Client
	URLs URLs
	// Attempts is how many times Fetch goes through the source and the
	// central bank before it gives up; Pause is the wait between.
	Attempts int
	Pause    time.Duration
}

// Fetch is the source's rates, or the central bank's when the source has
// none, and the bank they are from. The two are gone through Attempts
// times, Pause apart, before it gives up; the context ends a pause.
func (c *Client) Fetch(ctx context.Context, source string) (Rates, string, error) {
	chain := []string{source}
	if source != CBU {
		chain = append(chain, CBU)
	}
	for attempt := 1; ; attempt++ {
		var errs []error
		for _, s := range chain {
			r, err := c.one(ctx, s)
			if err == nil {
				return r, s, nil
			}
			errs = append(errs, fmt.Errorf("%s: %w", s, err))
		}
		if attempt >= c.Attempts {
			return Rates{}, "", fmt.Errorf("bankrate: no bank answered: %w", errors.Join(errs...))
		}
		select {
		case <-ctx.Done():
			return Rates{}, "", ctx.Err()
		case <-time.After(c.Pause):
		}
	}
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

// New is the client the API runs with: the banks' own addresses (tw-dobroe's),
// 15 seconds a request, the chain three times a minute apart.
func New() *Client {
	return &Client{
		HTTP: &http.Client{Timeout: 15 * time.Second},
		URLs: URLs{
			CBU:        "https://cbu.uz/ru/arkhiv-kursov-valyut/json/",
			Aggregator: "https://valyutalarkursi.uz/ru/exchange-rates/",
			Kapital:    "https://kapitalbank.uz/uz/welcome/show_curs/",
			IpakYuli:   "https://ipakyulibank.uz/uz/physical/exchange-rates",
			Asaka:      "https://asakabank.uz/uz/personal/foreign-currency-exchange/",
			Hamkor:     "https://hamkorbank.uz/uz/exchange-rate/",
			Uzum:       "https://uzumbank.uz/uz/currency",
			OFB:        "https://ofb.uz/kursy-valyut",
		},
		Attempts: 3,
		Pause:    time.Minute,
	}
}
