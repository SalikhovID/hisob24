package warehouse

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/SalikhovID/hisob24/backend/internal/db/gen"
)

// zero is an amount of nothing, for a move that only adds or only removes.
var zero = mustNumeric("0")

func mustNumeric(s string) pgtype.Numeric {
	var n pgtype.Numeric
	if err := n.Scan(s); err != nil {
		panic(err)
	}
	return n
}

// moveStock moves the product's stock in the location by added − removed,
// in the database; the row is made on the first move. Below zero is refused
// (409 stock_insufficient).
func moveStock(ctx context.Context, q *gen.Queries, companyID, locationID, productID int64, added, removed pgtype.Numeric) error {
	if err := q.EnsureStock(ctx, gen.EnsureStockParams{CompanyID: companyID, LocationID: locationID, ProductID: productID}); err != nil {
		return err
	}
	err := q.MoveStock(ctx, gen.MoveStockParams{LocationID: locationID, ProductID: productID, Added: added, Removed: removed})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23514" && pgErr.ConstraintName == "stock_quantity_check" {
		return errStockInsufficient
	}
	return err
}
