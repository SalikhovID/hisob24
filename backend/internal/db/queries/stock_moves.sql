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
-- moment; an order's by its order and title), the location, the quantity
-- moved (in above zero, out below) and the counterpart (the supplier's
-- name, the customer's name or phone, or a transfer's other location; ""
-- for none).
SELECT sm.id, t.id AS transaction_id, t.kind, t.number, t.doc_at, l.id AS location_id, l.name AS location_name, sm.quantity,
       COALESCE(s.name, cn.name, cu.phone, CASE WHEN t.kind = 'transfer' AND sm.location_id = t.location_id THEN tl.name WHEN t.kind = 'transfer' THEN fl.name END, '')::text AS counterpart,
       o.id AS order_id, o.title AS order_title
FROM stock_moves sm
JOIN transactions t ON t.id = sm.transaction_id
JOIN locations l ON l.id = sm.location_id
LEFT JOIN suppliers s ON s.id = t.supplier_id
LEFT JOIN customers cu ON cu.id = t.customer_id
LEFT JOIN LATERAL (SELECT v.text_value AS name FROM customer_fields f
                     LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = cu.id
                   WHERE f.type_id = cu.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
                   ORDER BY f.position, f.id LIMIT 1) cn ON cu.id IS NOT NULL
LEFT JOIN orders o ON o.id = t.order_id
LEFT JOIN locations tl ON tl.id = t.to_location_id
LEFT JOIN locations fl ON fl.id = t.location_id
WHERE sm.product_id = sqlc.arg('product_id') AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[]) AND t.deleted_at IS NULL
ORDER BY t.doc_at DESC, t.id DESC, sm.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductMoves :one
-- How many rows ListProductMoves finds, on all of its pages.
SELECT count(*) FROM stock_moves sm JOIN transactions t ON t.id = sm.transaction_id
WHERE sm.product_id = sqlc.arg('product_id') AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[]) AND t.deleted_at IS NULL;

-- name: ListProductCostMoves :many
-- The live moves of the products given, by product, then in time (the
-- document's moment, the document, a document's move out before its move
-- in, the move), each with the unit cost in so'm its document's line
-- bought the product at (a purchase's or an opening stock's price, by the
-- document's rate row; nothing for the other kinds): what the FIFO cost is
-- replayed from (logic/warehouse.md, section 10).
SELECT sm.id, sm.transaction_id, sm.product_id, sm.location_id, t.kind, t.doc_at, sm.quantity,
       convert_amount(i.price, t.currency_id, 1, cr)::numeric(14,2) AS unit_cost_uzs
FROM stock_moves sm
JOIN transactions t ON t.id = sm.transaction_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN transaction_items i ON i.transaction_id = sm.transaction_id AND i.product_id = sm.product_id AND t.kind IN ('purchase', 'opening_stock')
WHERE sm.company_id = sqlc.arg('company_id') AND sm.product_id = ANY(sqlc.arg('product_ids')::bigint[]) AND t.deleted_at IS NULL
ORDER BY sm.product_id, t.doc_at, t.id, (sm.quantity < 0) DESC, sm.id;
