package ledger

import (
	"context"
	"fmt"
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/apperr"
	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// Line is a line of a goods document as the moves are made from it: the
// product, the quantity entered (counted, in an inventory) and, in an
// inventory, the stock expected.
type Line struct {
	ProductID int64
	Quantity  pgtype.Numeric
	Expected  pgtype.Numeric
}

// Move is one move of the stock journal: the product's quantity into
// (above zero) or out of (below) the location.
type Move struct {
	LocationID int64
	ProductID  int64
	Quantity   pgtype.Numeric
}

// MovesOf is what a document of the kind moves (logic/warehouse.md, section
// 5): a purchase and an opening stock add their lines to the location, a
// sale takes them out, a transfer takes them out of the location and adds
// them to the other, an inventory moves the difference between what was
// counted and what was expected. A move of nothing is left out; a money
// document moves nothing.
func MovesOf(kind Kind, locationID, toLocationID int64, lines []Line) []Move {
	var moves []Move
	add := func(locationID, productID int64, quantity *big.Rat) {
		if quantity.Sign() == 0 {
			return
		}
		moves = append(moves, Move{LocationID: locationID, ProductID: productID, Quantity: numeric(quantity)})
	}
	for _, l := range lines {
		quantity := rat(l.Quantity)
		switch kind {
		case Purchase, OpeningStock:
			add(locationID, l.ProductID, quantity)
		case Sale:
			add(locationID, l.ProductID, quantity.Neg(quantity))
		case Transfer:
			add(locationID, l.ProductID, new(big.Rat).Neg(quantity))
			add(toLocationID, l.ProductID, quantity)
		case Inventory:
			add(locationID, l.ProductID, quantity.Sub(quantity, rat(l.Expected)))
		}
	}
	return moves
}

// WriteMoves writes the document's moves anew: what it moved before is
// removed first.
func WriteMoves(ctx context.Context, q *gen.Queries, companyID, transactionID int64, moves []Move) error {
	if err := q.DeleteStockMoves(ctx, transactionID); err != nil {
		return err
	}
	for _, m := range moves {
		if err := q.AddStockMove(ctx, gen.AddStockMoveParams{TransactionID: transactionID, CompanyID: companyID, LocationID: m.LocationID, ProductID: m.ProductID, Quantity: m.Quantity}); err != nil {
			return err
		}
	}
	return nil
}

// CheckStock refuses the write when, after it, one of the products is
// below zero in one of the locations: 409 stock_insufficient, naming the
// first such product by name (logic/warehouse.md, section 5).
func CheckStock(ctx context.Context, q *gen.Queries, locationIDs, productIDs []int64) error {
	if len(locationIDs) == 0 || len(productIDs) == 0 {
		return nil
	}
	below, err := q.NegativeStock(ctx, gen.NegativeStockParams{LocationIds: locationIDs, ProductIds: productIDs})
	if err != nil {
		return err
	}
	if len(below) > 0 {
		return StockInsufficient(below[0].Name)
	}
	return nil
}

// StockInsufficient is the refusal of a write that would take the product
// below zero.
func StockInsufficient(name string) error {
	return apperr.New(apperr.Conflict, "stock_insufficient", fmt.Sprintf("«%s» uchun omborda yetarli qoldiq yo'q", name))
}

// rat is the numeric as a rational, 0 when there is none.
func rat(n pgtype.Numeric) *big.Rat {
	if !n.Valid || n.Int == nil {
		return new(big.Rat)
	}
	r := new(big.Rat).SetInt(n.Int)
	scale := new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(abs(n.Exp))), nil))
	if n.Exp < 0 {
		return r.Quo(r, scale)
	}
	return r.Mul(r, scale)
}

// numeric is the rational as a numeric with three decimals (a quantity).
func numeric(r *big.Rat) pgtype.Numeric {
	var n pgtype.Numeric
	if err := n.Scan(r.FloatString(3)); err != nil {
		panic(err)
	}
	return n
}

func abs(v int32) int32 {
	if v < 0 {
		return -v
	}
	return v
}
