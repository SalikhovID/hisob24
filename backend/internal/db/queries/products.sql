-- name: CreateProduct :one
-- Enters a product (unit set) or a service (unit NULL). created_by_name is
-- the name the member who enters it goes by in the company now: it stays
-- when they leave. The name is one row's among the company's rows of the
-- kind, the SKU one product's in the company (23505, whatever the case).
INSERT INTO products (company_id, kind, name, unit, sku, price, currency_id, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('kind'), sqlc.arg('name'), sqlc.narg('unit'), sqlc.narg('sku'),
        sqlc.narg('price'), sqlc.arg('currency_id'), sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetProduct :one
-- The company's product or service; pgx.ErrNoRows when it has none such, or
-- deleted it. created_by_name is the name the member who entered it goes by
-- in the company now; once they have left it (or go by no name), the name
-- of then. quantity is the product's stock in the locations given (the
-- member's, or the one asked for), NULL for a service; last_price is the
-- price of its newest live purchase or opening stock line, whatever the
-- location, with that document's currency (last_price_currency_id, 0 with
-- no price), NULL when it was never bought.
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.currency_id, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       CASE WHEN p.kind = 'product'
            THEN COALESCE((SELECT sum(sm.quantity) FROM stock_moves sm
                           WHERE sm.product_id = p.id AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[])), 0)
       END::numeric(14,3) AS quantity,
       lp.price AS last_price, COALESCE(lp.currency_id, 0)::bigint AS last_price_currency_id
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
LEFT JOIN LATERAL (SELECT i.price, t.currency_id FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id
                   WHERE i.product_id = p.id AND t.deleted_at IS NULL AND t.kind IN ('purchase', 'opening_stock') AND i.price IS NOT NULL
                   ORDER BY t.doc_at DESC, t.id DESC LIMIT 1) lp ON true
WHERE p.id = sqlc.arg('id') AND p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL;

-- name: ListProducts :many
-- A page of the company's products or services (kind), the active or the
-- inactive ones (is_active), by name whatever the case, without the deleted.
-- search, escaped for ILIKE, is looked for in the name and in the SKU; NULL
-- leaves it out. The columns are GetProduct's (quantity in the locations
-- given, last_price with its currency).
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.currency_id, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       CASE WHEN p.kind = 'product'
            THEN COALESCE((SELECT sum(sm.quantity) FROM stock_moves sm
                           WHERE sm.product_id = p.id AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[])), 0)
       END::numeric(14,3) AS quantity,
       lp.price AS last_price, COALESCE(lp.currency_id, 0)::bigint AS last_price_currency_id
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
LEFT JOIN LATERAL (SELECT i.price, t.currency_id FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id
                   WHERE i.product_id = p.id AND t.deleted_at IS NULL AND t.kind IN ('purchase', 'opening_stock') AND i.price IS NOT NULL
                   ORDER BY t.doc_at DESC, t.id DESC LIMIT 1) lp ON true
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.kind = sqlc.arg('kind') AND p.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR p.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR p.sku ILIKE '%' || sqlc.narg('search')::text || '%')
ORDER BY lower(p.name), p.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProducts :one
-- How many rows ListProducts finds under the same filter, on all of its pages.
SELECT count(*) FROM products p
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.kind = sqlc.arg('kind') AND p.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR p.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR p.sku ILIKE '%' || sqlc.narg('search')::text || '%');

-- name: UpdateProduct :one
-- An edit: every field as it is now (NULL clears an optional one), and the
-- moment of the edit. The kind stays. pgx.ErrNoRows when the company has no
-- such row, or deleted it; 23505 when the name or the SKU is another's.
UPDATE products
SET name = sqlc.arg('name'), unit = sqlc.narg('unit'), sku = sqlc.narg('sku'), price = sqlc.narg('price'),
    currency_id = sqlc.arg('currency_id'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetProductActive :one
-- Turns a product or a service off (no longer offered) or on again.
-- pgx.ErrNoRows when the company has no such row, or deleted it.
UPDATE products SET is_active = sqlc.arg('is_active'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteProduct :one
-- Hides the product or the service: nothing is removed, and its name and SKU
-- are free again. pgx.ErrNoRows when the company has no such row, or
-- deleted it already.
UPDATE products SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: ProductStanding :one
-- The company's live product or service: its kind, name and whether it is
-- active (what a purchase line may name). pgx.ErrNoRows when the company
-- has none such, or deleted it.
SELECT kind, name, is_active FROM products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
