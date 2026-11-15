package bankrate

import (
	"strconv"
	"strings"
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
