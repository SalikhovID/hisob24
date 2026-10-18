package costing

import (
	"context"
	"math/big"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
	"github.com/SalikhovID/hisob24/backend/internal/numtext"
)

// Lines is what the document's moves out of each of the products cost, in
// so'm, by FIFO over the company's journal: each product's live moves,
// in every location, replayed in time. A product the document moved
// nothing of (a service, a line taken away) costs nothing.
func Lines(ctx context.Context, q *gen.Queries, companyID, transactionID int64, productIDs []int64) (map[int64]*big.Rat, error) {
	costs := make(map[int64]*big.Rat, len(productIDs))
	for _, id := range productIDs {
		costs[id] = new(big.Rat)
	}
	if len(productIDs) == 0 {
		return costs, nil
	}
	rows, err := q.ListProductCostMoves(ctx, gen.ListProductCostMovesParams{CompanyID: companyID, ProductIds: productIDs})
	if err != nil {
		return nil, err
	}
	byProduct := make(map[int64][]Move)
	for _, r := range rows {
		m := Move{TransactionID: r.TransactionID, LocationID: r.LocationID, Kind: r.Kind, Quantity: numtext.Rat(r.Quantity)}
		if r.UnitCostUzs.Valid {
			m.UnitCostUZS = numtext.Rat(r.UnitCostUzs)
		}
		byProduct[r.ProductID] = append(byProduct[r.ProductID], m)
	}
	for productID, moves := range byProduct {
		if cost, ok := FIFO(moves)[transactionID]; ok {
			costs[productID] = cost
		}
	}
	return costs, nil
}
