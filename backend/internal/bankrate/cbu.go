package bankrate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
)

// cbuRate is a currency of the central bank's JSON: its code, how many
// units the rate is for and the rate in so'm.
type cbuRate struct {
	Ccy     string `json:"Ccy"`
	Nominal string `json:"Nominal"`
	Rate    string `json:"Rate"`
}

// cbu is the central bank's official rates, from its JSON; a rate for more
// than one unit is divided by them. The dollar, the euro and the ruble are
// all there, or it is an error.
func (c *Client) cbu(ctx context.Context) (Rates, error) {
	body, err := c.get(ctx, c.URLs.CBU, "application/json")
	if err != nil {
		return Rates{}, fmt.Errorf("cbu: %w", err)
	}
	var list []cbuRate
	if err := json.Unmarshal(body, &list); err != nil {
		return Rates{}, fmt.Errorf("cbu: decode: %w", err)
	}
	var r Rates
	for _, item := range list {
		rate, err := strconv.ParseFloat(item.Rate, 64)
		if err != nil || rate <= 0 {
			continue
		}
		if nominal, err := strconv.ParseFloat(item.Nominal, 64); err == nil && nominal > 0 {
			rate /= nominal
		}
		switch item.Ccy {
		case "USD":
			r.USD = rate
		case "EUR":
			r.EUR = rate
		case "RUB":
			r.RUB = rate
		}
	}
	if r.USD == 0 || r.EUR == 0 || r.RUB == 0 {
		return Rates{}, errors.New("cbu: no rate of the dollar, the euro or the ruble")
	}
	return r, nil
}
