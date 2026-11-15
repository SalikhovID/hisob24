package bankrate

import (
	"errors"
	"strings"

	"golang.org/x/net/html"
)

// parseOFB is Orient Finans Bank's selling rates from the currency table of
// its page: only the table whose class has "currency-table" counts, so a
// calculator's numbers cannot stand in for a rate. A row names the
// currency in its first cell and sells at its third; the first of each
// currency counts. The dollar and the euro have to be there.
func parseOFB(doc *html.Node) (Rates, error) {
	var table *html.Node
	for _, t := range nodesByTag(doc, "table") {
		if strings.Contains(attr(t, "class"), "currency-table") {
			table = t
			break
		}
	}
	if table == nil {
		return Rates{}, errors.New("ofb: no currency-table")
	}
	var r Rates
	for _, tr := range nodesByTag(table, "tr") {
		cells := nodesByTag(tr, "td")
		if len(cells) < 3 {
			continue
		}
		sell, err := parseRateNumber(textContent(cells[2]))
		if err != nil {
			continue
		}
		switch code := ofbCurrency(cells[0]); {
		case code == "USD" && r.USD == 0:
			r.USD = sell
		case code == "EUR" && r.EUR == 0:
			r.EUR = sell
		case code == "RUB" && r.RUB == 0:
			r.RUB = sell
		}
	}
	if r.USD == 0 || r.EUR == 0 {
		return Rates{}, errors.New("ofb: no rate of the dollar or the euro in the currency-table")
	}
	return r, nil
}

// ofbCurrency is the currency a row's first cell names: by its flag's alt
// ("USD flag"), else by its text ("1 USD"); "" for another.
func ofbCurrency(cell *html.Node) string {
	for _, img := range nodesByTag(cell, "img") {
		alt := strings.ToUpper(attr(img, "alt"))
		for _, code := range []string{"USD", "EUR", "RUB"} {
			if strings.HasPrefix(alt, code) {
				return code
			}
		}
	}
	text := strings.ToUpper(textContent(cell))
	for _, code := range []string{"USD", "EUR", "RUB"} {
		if strings.Contains(text, "1 "+code) {
			return code
		}
	}
	return ""
}
