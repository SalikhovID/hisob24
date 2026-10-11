-- name: AddStockMove :exec
-- Writes a move of the document: the product's quantity into (above zero)
-- or out of (below) the location. 23514 on a move of nothing.
INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity)
VALUES (sqlc.arg('transaction_id'), sqlc.arg('company_id'), sqlc.arg('location_id'), sqlc.arg('product_id'), sqlc.arg('quantity'));

-- name: DeleteStockMoves :exec
-- Removes the document's moves: the document is hidden, or its lines are
-- written anew.
DELETE FROM stock_moves WHERE transaction_id = $1;

-- name: NegativeStock :many
-- The products among those given whose stock in one of the locations given
-- is below zero, by name: what a write is refused for (logic/warehouse.md,
-- section 5).
SELECT p.id, p.name
FROM stock_moves sm
JOIN products p ON p.id = sm.product_id
WHERE sm.location_id = ANY(sqlc.arg('location_ids')::bigint[]) AND sm.product_id = ANY(sqlc.arg('product_ids')::bigint[])
GROUP BY sm.location_id, p.id, p.name
HAVING sum(sm.quantity) < 0
ORDER BY p.name, p.id;

-- name: StockOf :one
-- The product's stock in the location: the sum of its moves, 0 with none.
SELECT COALESCE(sum(quantity), 0)::numeric(14,3) AS quantity FROM stock_moves WHERE location_id = $1 AND product_id = $2;

-- name: ListProductStock :many
-- The product's stock in each of the locations given (the member's), in
-- the order the locations were added; a location with none is listed with 0.
SELECT l.id AS location_id, l.name AS location_name, COALESCE(s.quantity, 0)::numeric(14,3) AS quantity
FROM locations l
LEFT JOIN (SELECT sm.location_id, sum(sm.quantity) AS quantity FROM stock_moves sm WHERE sm.product_id = sqlc.arg('product_id') GROUP BY sm.location_id) s
       ON s.location_id = l.id
WHERE l.company_id = sqlc.arg('company_id') AND l.deleted_at IS NULL AND l.id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY l.created_at, l.id;
