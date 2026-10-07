package catalog

// Unit is a unit a product is measured in: its code, as it is kept, and its
// name on screen.
type Unit struct {
	Code string
	Name string
}

// Units is the list a product's unit is chosen from (logic/products.md,
// 3.2). It is not set up per company; the column's CHECK lists the same.
var Units = []Unit{
	{"dona", "dona"}, {"kg", "kg"}, {"g", "g"}, {"l", "l"}, {"ml", "ml"},
	{"m", "m"}, {"m2", "m²"}, {"quti", "quti"}, {"juft", "juft"}, {"komplekt", "komplekt"},
}

// unitKnown tells whether code is one of the Units.
func unitKnown(code string) bool {
	for _, u := range Units {
		if u.Code == code {
			return true
		}
	}
	return false
}
