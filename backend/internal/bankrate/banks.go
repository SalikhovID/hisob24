package bankrate

import (
	"context"
	"fmt"
)

// one is the source's rates, each bank read the way its pages allow, as
// tw-dobroe reads them: the central bank's JSON; Kapitalbank (its site is
// behind a Cloudflare challenge), Asakabank and Hamkorbank (theirs render
// the rates in the browser) at the aggregator, then their page; Ipak
// Yo'li's Nuxt payload, then the aggregator, then its page; OFB's table,
// then the aggregator, then its page; Uzum Bank's page.
func (c *Client) one(ctx context.Context, source string) (Rates, error) {
	switch source {
	case CBU:
		return c.cbu(ctx)
	case Kapital:
		return c.aggregatorOrPage(ctx, aggregatorKapital, c.URLs.Kapital)
	case Asaka:
		return c.aggregatorOrPage(ctx, aggregatorAsaka, c.URLs.Asaka)
	case Hamkor:
		return c.aggregatorOrPage(ctx, aggregatorHamkor, c.URLs.Hamkor)
	case IpakYuli:
		if doc, err := c.page(ctx, c.URLs.IpakYuli); err == nil {
			if r, err := parseIpakYuli(doc); err == nil {
				return r, nil
			}
		}
		return c.aggregatorOrPage(ctx, aggregatorIpakYuli, c.URLs.IpakYuli)
	case OFB:
		if doc, err := c.page(ctx, c.URLs.OFB); err == nil {
			if r, err := parseOFB(doc); err == nil {
				return r, nil
			}
		}
		return c.aggregatorOrPage(ctx, aggregatorOFB, c.URLs.OFB)
	case Uzum:
		return c.scrape(ctx, c.URLs.Uzum)
	}
	return Rates{}, fmt.Errorf("bankrate: %q is not a bank", source)
}

// aggregatorOrPage is the bank's rates at the aggregator, or read off its
// page when the aggregator has none.
func (c *Client) aggregatorOrPage(ctx context.Context, bankID int, page string) (Rates, error) {
	if r, err := c.aggregator(ctx, bankID); err == nil {
		return r, nil
	}
	return c.scrape(ctx, page)
}
