package bankrate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// The banks' ids at valyutalarkursi.uz.
const (
	aggregatorIpakYuli = 14
	aggregatorKapital  = 15
	aggregatorAsaka    = 4
	aggregatorHamkor   = 24
	aggregatorOFB      = 20
)

// aggregatorEntry is a rate of the aggregator's list: whose, of which
// currency, where it is given (branch, atm, app, cbu) and the selling rate.
type aggregatorEntry struct {
	Bank struct {
		ID int `json:"id"`
	} `json:"bank"`
	Currency struct {
		Code string `json:"code"`
	} `json:"currency"`
	RateType string  `json:"rate_type"`
	SellRate float64 `json:"sell_rate"`
}

// aggregator is a bank's selling rates at its branches, from the
// valyutalarkursi.uz aggregator, for the banks whose own pages give no rate
// a program can read. The first of each currency counts; the dollar and the
// euro have to be there, the ruble may not be.
func (c *Client) aggregator(ctx context.Context, bankID int) (Rates, error) {
	body, err := c.get(ctx, c.URLs.Aggregator, "application/json")
	if err != nil {
		return Rates{}, fmt.Errorf("valyutalarkursi: %w", err)
	}
	var entries []aggregatorEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		return Rates{}, fmt.Errorf("valyutalarkursi: decode: %w", err)
	}
	var r Rates
	for _, e := range entries {
		if e.Bank.ID != bankID || e.RateType != "branch" || e.SellRate <= 0 {
			continue
		}
		switch {
		case e.Currency.Code == "USD" && r.USD == 0:
			r.USD = e.SellRate
		case e.Currency.Code == "EUR" && r.EUR == 0:
			r.EUR = e.SellRate
		case e.Currency.Code == "RUB" && r.RUB == 0:
			r.RUB = e.SellRate
		}
	}
	if r.USD == 0 || r.EUR == 0 {
		return Rates{}, errors.New("valyutalarkursi: no rate of the dollar or the euro for the bank")
	}
	return r, nil
}
