-- name: CreateProduct :one
-- Enters a product (unit set) or a service (unit NULL). created_by_name is
-- the name the member who enters it goes by in the company now: it stays
-- when they leave. The name is one row's among the company's rows of the
-- kind, the SKU one product's in the company (23505, whatever the case).
INSERT INTO products (company_id, kind, name, unit, sku, price, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('kind'), sqlc.arg('name'), sqlc.narg('unit'), sqlc.narg('sku'),
        sqlc.narg('price'), sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetProduct :one
-- The company's product or service; pgx.ErrNoRows when it has none such, or
-- deleted it. created_by_name is the name the member who entered it goes by
-- in the company now; once they have left it (or go by no name), the name
-- of then. quantity is the product's stock in the locations given (the
-- member's, or the one asked for), NULL for a service; last_price is the
-- price of its newest live purchase line, whatever the location, NULL when
-- it was never bought.
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       CASE WHEN p.kind = 'product'
            THEN COALESCE((SELECT sum(s.quantity) FROM stock s
                           WHERE s.product_id = p.id AND s.location_id = ANY(sqlc.arg('location_ids')::bigint[])), 0)
       END::numeric(14,3) AS quantity,
       (SELECT i.price FROM purchase_items i JOIN purchases pu ON pu.id = i.purchase_id
         WHERE i.product_id = p.id AND pu.deleted_at IS NULL
         ORDER BY pu.purchased_on DESC, pu.id DESC LIMIT 1) AS last_price
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL;

-- name: ListProducts :many
-- A page of the company's products or services (kind), the active or the
-- inactive ones (is_active), by name whatever the case, without the deleted.
-- search, escaped for ILIKE, is looked for in the name and in the SKU; NULL
-- leaves it out. The columns are GetProduct's (quantity in the locations
-- given, last_price).
SELECT p.id, p.kind, p.name, p.unit, p.sku, p.price, p.note, p.is_active, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       CASE WHEN p.kind = 'product'
            THEN COALESCE((SELECT sum(s.quantity) FROM stock s
                           WHERE s.product_id = p.id AND s.location_id = ANY(sqlc.arg('location_ids')::bigint[])), 0)
       END::numeric(14,3) AS quantity,
       (SELECT i.price FROM purchase_items i JOIN purchases pu ON pu.id = i.purchase_id
         WHERE i.product_id = p.id AND pu.deleted_at IS NULL
         ORDER BY pu.purchased_on DESC, pu.id DESC LIMIT 1) AS last_price
FROM products p
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
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
    note = sqlc.narg('note'), updated_at = now()
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

-- name: ListProductStock :many
-- The product's stock in each of the locations given (the member's), in
-- the order the locations were added; a location with none is listed with 0.
SELECT l.id AS location_id, l.name AS location_name, COALESCE(s.quantity, 0)::numeric(14,3) AS quantity
FROM locations l
LEFT JOIN stock s ON s.location_id = l.id AND s.product_id = sqlc.arg('product_id')
WHERE l.company_id = sqlc.arg('company_id') AND l.deleted_at IS NULL AND l.id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY l.created_at, l.id;

-- name: CountProductPurchases :one
-- How many live purchases hold the product, in any location: one held is
-- not deleted (logic/products.md, section 4).
SELECT count(*) FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
WHERE i.product_id = $1 AND p.deleted_at IS NULL;

-- name: ListProductPurchases :many
-- A page of the live purchase lines of the product in the locations given,
-- the newest purchase first: the purchase, its supplier and location, the
-- line's quantity, price and what it comes to.
SELECT p.id AS purchase_id, p.number, p.purchased_on, p.supplier_id, s.name AS supplier_name, p.location_id, l.name AS location_name,
       i.quantity, i.price, (i.quantity * i.price)::numeric(14,2) AS amount
FROM purchase_items i
JOIN purchases p ON p.id = i.purchase_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN locations l ON l.id = p.location_id
WHERE i.product_id = sqlc.arg('product_id') AND p.deleted_at IS NULL AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY p.purchased_on DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductPurchaseLines :one
-- How many rows ListProductPurchases finds, on all of its pages.
SELECT count(*) FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
WHERE i.product_id = sqlc.arg('product_id') AND p.deleted_at IS NULL AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[]);
