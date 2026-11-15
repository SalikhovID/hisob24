package bankrate

import (
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/net/html"
)

// parseIpakYuli is Ipak Yo'li's selling rates from the __NUXT_DATA__ its
// page is rendered with: Nuxt's "devalue", a flat array whose objects hold
// the indices of their values. A rate is an object with buy, sell and cb,
// its currency's code two places before it, each value a hundred times the
// so'm (1219000 is 12 190). The dollar and the euro have to be there.
func parseIpakYuli(doc *html.Node) (Rates, error) {
	payload := nuxtPayload(doc)
	if payload == "" {
		return Rates{}, errors.New("ipakyuli: no __NUXT_DATA__")
	}
	var data []json.RawMessage
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return Rates{}, fmt.Errorf("ipakyuli: decode __NUXT_DATA__: %w", err)
	}
	var r Rates
	for i := 2; i < len(data); i++ {
		var obj struct {
			Buy  int `json:"buy"`
			Sell int `json:"sell"`
			CB   int `json:"cb"`
		}
		if json.Unmarshal(data[i], &obj) != nil || obj.Buy <= 0 || obj.Sell <= 0 || obj.CB <= 0 {
			continue
		}
		var code string
		if json.Unmarshal(data[i-2], &code) != nil {
			continue
		}
		sell, ok := valueAt(data, obj.Sell)
		if !ok {
			continue
		}
		switch {
		case code == "USD" && r.USD == 0:
			r.USD = sell / 100
		case code == "EUR" && r.EUR == 0:
			r.EUR = sell / 100
		case code == "RUB" && r.RUB == 0:
			r.RUB = sell / 100
		}
	}
	if r.USD == 0 || r.EUR == 0 {
		return Rates{}, errors.New("ipakyuli: no rate of the dollar or the euro in __NUXT_DATA__")
	}
	return r, nil
}

// nuxtPayload is the text of the page's __NUXT_DATA__ script, "" without one.
func nuxtPayload(doc *html.Node) string {
	for _, s := range nodesByTag(doc, "script") {
		if attr(s, "id") == "__NUXT_DATA__" && s.FirstChild != nil && s.FirstChild.Type == html.TextNode {
			return s.FirstChild.Data
		}
	}
	return ""
}

// valueAt is the number at the index of the payload, if it is one.
func valueAt(data []json.RawMessage, i int) (float64, bool) {
	if i < 0 || i >= len(data) {
		return 0, false
	}
	var n float64
	if json.Unmarshal(data[i], &n) != nil {
		return 0, false
	}
	return n, true
}
