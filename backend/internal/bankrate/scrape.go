package bankrate

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/net/html"
)

// parseRateNumber reads a rate as a bank's page writes it: "12 141.94",
// "12,141.94", "12141,94", "12.141,94", spaces and no-break spaces apart.
// With both a comma and a dot the last of them is the decimal point; a
// comma alone is one.
func parseRateNumber(s string) (float64, error) {
	cleaned := strings.ReplaceAll(s, " ", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")

	dot := strings.LastIndex(cleaned, ".")
	comma := strings.LastIndex(cleaned, ",")
	switch {
	case dot >= 0 && comma >= 0 && dot > comma:
		cleaned = strings.ReplaceAll(cleaned, ",", "")
	case dot >= 0 && comma >= 0:
		cleaned = strings.ReplaceAll(cleaned, ".", "")
		cleaned = strings.Replace(cleaned, ",", ".", 1)
	case comma >= 0:
		cleaned = strings.Replace(cleaned, ",", ".", 1)
	}
	return strconv.ParseFloat(cleaned, 64)
}

// scrape is a bank's rates read off its page's text: after the name of
// each currency, the first number in the range a rate of it falls in. The
// dollar and the euro have to be there; a page without the ruble gives 0.
func (c *Client) scrape(ctx context.Context, url string) (Rates, error) {
	doc, err := c.page(ctx, url)
	if err != nil {
		return Rates{}, err
	}
	text := textContent(doc)
	var r Rates
	if r.USD, err = rateAfter(text, []string{"USD", "Доллар", "Dollar"}, 8000, 20000); err != nil {
		return Rates{}, fmt.Errorf("USD: %w", err)
	}
	if r.EUR, err = rateAfter(text, []string{"EUR", "Евро", "Yevro"}, 9000, 22000); err != nil {
		return Rates{}, fmt.Errorf("EUR: %w", err)
	}
	// Some banks do not list the ruble: 0, not an error.
	r.RUB, _ = rateAfter(text, []string{"RUB", "Рубль", "Rubl"}, 80, 300)
	return r, nil
}

// page is the bank's page, parsed.
func (c *Client) page(ctx context.Context, url string) (*html.Node, error) {
	body, err := c.get(ctx, url, "text/html,application/xhtml+xml")
	if err != nil {
		return nil, fmt.Errorf("%s: %w", url, err)
	}
	doc, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%s: parse: %w", url, err)
	}
	return doc, nil
}

// textContent is the text a reader sees in the node, a space between each
// piece: scripts, styles and comments left out.
func textContent(n *html.Node) string {
	var sb strings.Builder
	collectText(n, &sb)
	return strings.TrimSpace(sb.String())
}

func collectText(n *html.Node, sb *strings.Builder) {
	if n.Type == html.ElementNode {
		switch n.Data {
		case "script", "style", "noscript":
			return
		}
	}
	if n.Type == html.TextNode {
		if t := strings.TrimSpace(n.Data); t != "" {
			sb.WriteString(t)
			sb.WriteByte(' ')
		}
	}
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		collectText(child, sb)
	}
}

// rateNumber is a number shaped like a rate: thousands apart by a space, a
// no-break space or a comma, with a decimal part ("12 141.94"), or plain
// with one ("140.50"), or a plain whole of three digits or more ("12141").
var rateNumber = regexp.MustCompile(`\d{1,3}(?:[ \x{a0},]\d{3})+(?:[.,]\d{1,4})?|\d{3,6}[.,]\d{1,4}|\d{3,6}`)

// rateAfter is the first number in [lowest, highest] within 200 bytes after
// the first of the labels the text has.
func rateAfter(text string, labels []string, lowest, highest float64) (float64, error) {
	upper := strings.ToUpper(text)
	for _, label := range labels {
		at := strings.Index(upper, strings.ToUpper(label))
		if at < 0 {
			continue
		}
		from := at + len(label)
		to := min(from+200, len(text))
		for _, m := range rateNumber.FindAllString(text[from:to], -1) {
			rate, err := parseRateNumber(m)
			if err == nil && rate >= lowest && rate <= highest {
				return rate, nil
			}
		}
	}
	return 0, fmt.Errorf("no rate after %v", labels)
}
