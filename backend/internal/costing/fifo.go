// Package costing finds what goods cost by FIFO over the stock journal
// (logic/warehouse.md, section 10): what an order's goods cost, and later
// the profit and loss report.
package costing

import "math/big"

// Move is one move of a product, as the journal keeps it: the document
// and its kind, the location, the quantity (into the location above zero,
// out of it below) and, for a purchase's or an opening stock's line, the
// unit cost in so'm; nil otherwise.
type Move struct {
	TransactionID int64
	LocationID    int64
	Kind          string
	Quantity      *big.Rat
	UnitCostUZS   *big.Rat
}

// lot is a quantity of the product that came into a location at one unit
// cost: what the moves out take, the oldest first.
type lot struct {
	quantity *big.Rat
	unitCost *big.Rat
}

// FIFO replays the moves of one product, given in time (a document's move
// out before its move in), and tells what each document's moves out
// cost, in so'm: what they took from the oldest lots of their location.
// A purchase's or an opening stock's move in is a lot at its unit cost,
// and that cost is the last known one; a transfer's move in is a lot at
// what its move out cost; an inventory's surplus is a lot at the last
// known unit cost. What a move out finds no lot for is costed at the last
// known unit cost, nothing when none is known yet.
func FIFO(moves []Move) map[int64]*big.Rat {
	costs := make(map[int64]*big.Rat)
	lots := make(map[int64][]lot)
	var lastKnown *big.Rat
	// carried is what a transfer's move out cost, for its move in.
	carried := make(map[int64]lot)
	for _, m := range moves {
		if m.Quantity.Sign() < 0 {
			quantity := new(big.Rat).Neg(m.Quantity)
			cost := take(lots, m.LocationID, quantity, lastKnown)
			if m.Kind == "transfer" {
				carried[m.TransactionID] = lot{quantity: quantity, unitCost: new(big.Rat).Quo(cost, quantity)}
			}
			total, ok := costs[m.TransactionID]
			if !ok {
				total = new(big.Rat)
				costs[m.TransactionID] = total
			}
			total.Add(total, cost)
			continue
		}
		unitCost := m.UnitCostUZS
		switch {
		case m.Kind == "transfer":
			if from, ok := carried[m.TransactionID]; ok {
				unitCost = from.unitCost
			}
		case unitCost != nil:
			lastKnown = unitCost
		default:
			unitCost = lastKnown
		}
		if unitCost == nil {
			unitCost = new(big.Rat)
		}
		lots[m.LocationID] = append(lots[m.LocationID], lot{quantity: new(big.Rat).Set(m.Quantity), unitCost: unitCost})
	}
	return costs
}

// take costs a quantity going out of the location from its oldest lots,
// the rest (once the lots are gone) at the last known unit cost.
func take(lots map[int64][]lot, locationID int64, quantity, lastKnown *big.Rat) *big.Rat {
	cost := new(big.Rat)
	left := new(big.Rat).Set(quantity)
	queue := lots[locationID]
	for left.Sign() > 0 && len(queue) > 0 {
		head := &queue[0]
		taken := head.quantity
		if taken.Cmp(left) > 0 {
			taken = left
		}
		cost.Add(cost, new(big.Rat).Mul(taken, head.unitCost))
		left = new(big.Rat).Sub(left, taken)
		head.quantity = new(big.Rat).Sub(head.quantity, taken)
		if head.quantity.Sign() == 0 {
			queue = queue[1:]
		}
	}
	lots[locationID] = queue
	if left.Sign() > 0 && lastKnown != nil {
		cost.Add(cost, new(big.Rat).Mul(left, lastKnown))
	}
	return cost
}
