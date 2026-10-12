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

-- name: ListStockAt :many
-- The stock of each product in the location at the moment: the moves of
-- the documents at or before it, leaving out the document given (an
-- inventory's own, when it is written anew; 0 for none). A product nothing
-- moved is not listed.
SELECT sm.product_id, sum(sm.quantity)::numeric(14,3) AS quantity
FROM stock_moves sm
JOIN transactions t ON t.id = sm.transaction_id
WHERE sm.location_id = sqlc.arg('location_id') AND t.doc_at <= sqlc.arg('at') AND t.id <> sqlc.arg('exclude_id')
GROUP BY sm.product_id;

-- name: ListLocationStock :many
-- The products in stock in the location at the moment (their stock then is
-- not 0), by name, each with its unit and stock, the moves of the document
-- given left out (an inventory's own, while it is edited; 0 for none)
-- (logic/warehouse.md, section 5).
SELECT p.id AS product_id, p.name, p.unit, sum(sm.quantity)::numeric(14,3) AS quantity
FROM stock_moves sm
JOIN transactions t ON t.id = sm.transaction_id
JOIN products p ON p.id = sm.product_id
WHERE sm.location_id = sqlc.arg('location_id') AND t.doc_at <= sqlc.arg('at') AND t.id <> sqlc.arg('exclude_id')
GROUP BY p.id, p.name, p.unit
HAVING sum(sm.quantity) <> 0
ORDER BY lower(p.name), p.id;

-- name: ListProductMoves :many
-- A page of the product's moves in the locations given, the newest
-- document first (then the later entered): the document (kind, number,
-- moment), the location, the quantity moved (in above zero, out below) and
-- the counterpart (the supplier's name, or a transfer's other location; ""
-- for none).
SELECT sm.id, t.id AS transaction_id, t.kind, t.number, t.doc_at, l.id AS location_id, l.name AS location_name, sm.quantity,
       COALESCE(s.name, CASE WHEN t.kind = 'transfer' AND sm.location_id = t.location_id THEN tl.name WHEN t.kind = 'transfer' THEN fl.name END, '')::text AS counterpart
FROM stock_moves sm
JOIN transactions t ON t.id = sm.transaction_id
JOIN locations l ON l.id = sm.location_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
LEFT JOIN locations tl ON tl.id = t.to_location_id
LEFT JOIN locations fl ON fl.id = t.location_id
WHERE sm.product_id = sqlc.arg('product_id') AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[]) AND t.deleted_at IS NULL
ORDER BY t.doc_at DESC, t.id DESC, sm.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductMoves :one
-- How many rows ListProductMoves finds, on all of its pages.
SELECT count(*) FROM stock_moves sm JOIN transactions t ON t.id = sm.transaction_id
WHERE sm.product_id = sqlc.arg('product_id') AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[]) AND t.deleted_at IS NULL;
