package costing

import (
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
)

// move is a move as a test writes it: the document, the location, the
// kind, the quantity (in above zero, out below) and, for a purchase's or
// an opening stock's line, the unit cost.
func move(tx, location int64, kind, quantity string, unitCost ...string) Move {
	m := Move{TransactionID: tx, LocationID: location, Kind: kind, Quantity: rat(quantity)}
	if len(unitCost) > 0 {
		m.UnitCostUZS = rat(unitCost[0])
	}
	return m
}

func rat(s string) *big.Rat {
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		panic(s)
	}
	return r
}

// costs is what FIFO found, as "tx:cost" strings with two decimals.
func costs(got map[int64]*big.Rat) map[int64]string {
	out := make(map[int64]string, len(got))
	for tx, cost := range got {
		out[tx] = cost.FloatString(2)
	}
	return out
}

// The moves of one product, in time; each move out is costed from the
// oldest lots of its location (logic/warehouse.md, section 10).
func TestFIFO(t *testing.T) {
	const asosiy, chilonzor = 1, 2
	for name, tc := range map[string]struct {
		moves []Move
		want  map[int64]string
	}{
		"one lot": {
			[]Move{move(1, asosiy, "purchase", "10", "1000"), move(2, asosiy, "sale", "-4")},
			map[int64]string{2: "4000.00"},
		},
		"the oldest lot first, then the next": {
			[]Move{move(1, asosiy, "purchase", "10", "1000"), move(2, asosiy, "purchase", "10", "1500"), move(3, asosiy, "order", "-12")},
			map[int64]string{3: "13000.00"},
		},
		"a lot left over is used next": {
			[]Move{move(1, asosiy, "purchase", "10", "1000"), move(2, asosiy, "purchase", "10", "1500"), move(3, asosiy, "sale", "-4"), move(4, asosiy, "order", "-8")},
			map[int64]string{3: "4000.00", 4: "9000.00"},
		},
		"more out than the lots: the rest at the last known unit cost": {
			[]Move{move(1, asosiy, "purchase", "2", "1000"), move(2, asosiy, "sale", "-5")},
			map[int64]string{2: "5000.00"},
		},
		"nothing known: nothing": {
			[]Move{move(1, asosiy, "sale", "-5")},
			map[int64]string{1: "0.00"},
		},
		"a lot that arrives later covers the next move out, not the earlier": {
			[]Move{move(1, asosiy, "sale", "-1"), move(2, asosiy, "purchase", "10", "1000"), move(3, asosiy, "sale", "-1")},
			map[int64]string{1: "0.00", 3: "1000.00"},
		},
		"a transfer carries the cost to the other location": {
			[]Move{move(1, asosiy, "purchase", "10", "1000"), move(2, asosiy, "transfer", "-4"), move(2, chilonzor, "transfer", "4"), move(3, chilonzor, "sale", "-3")},
			map[int64]string{2: "4000.00", 3: "3000.00"},
		},
		"a transfer out of several lots carries their mixed cost": {
			[]Move{move(1, asosiy, "purchase", "2", "1000"), move(2, asosiy, "purchase", "2", "2000"), move(3, asosiy, "transfer", "-3"), move(3, chilonzor, "transfer", "3"), move(4, chilonzor, "sale", "-3")},
			map[int64]string{3: "4000.00", 4: "4000.00"},
		},
		"an inventory's surplus is a lot at the last known unit cost": {
			[]Move{move(1, asosiy, "purchase", "1", "1000"), move(2, asosiy, "inventory", "2"), move(3, asosiy, "sale", "-3")},
			map[int64]string{3: "3000.00"},
		},
		"an inventory's shortage goes out like a sale": {
			[]Move{move(1, asosiy, "purchase", "5", "1000"), move(2, asosiy, "inventory", "-2"), move(3, asosiy, "sale", "-3")},
			map[int64]string{2: "2000.00", 3: "3000.00"},
		},
		"the last known unit cost is the newest purchase's, whatever the location": {
			[]Move{move(1, asosiy, "purchase", "1", "1000"), move(2, chilonzor, "purchase", "1", "3000"), move(3, asosiy, "sale", "-2")},
			map[int64]string{3: "4000.00"},
		},
		"an opening stock is a lot too": {
			[]Move{move(1, asosiy, "opening_stock", "3", "500"), move(2, asosiy, "sale", "-2")},
			map[int64]string{2: "1000.00"},
		},
		"decimals": {
			[]Move{move(1, asosiy, "purchase", "1.5", "1000.33"), move(2, asosiy, "sale", "-0.5")},
			map[int64]string{2: "500.17"},
		},
		"two moves out of one document add up": {
			[]Move{move(1, asosiy, "purchase", "10", "1000"), move(2, asosiy, "sale", "-1"), move(2, asosiy, "sale", "-2")},
			map[int64]string{2: "3000.00"},
		},
		"nothing": {nil, map[int64]string{}},
	} {
		assert.Equal(t, tc.want, costs(FIFO(tc.moves)), name)
	}
}
