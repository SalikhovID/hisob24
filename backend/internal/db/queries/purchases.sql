-- name: NextPurchaseNumber :one
-- The number the company's next purchase takes: one past the highest so
-- far, the deleted purchases counted (a number is never given twice). Run
-- under the company's lock (LockCompanyCustomers), so two purchases entered
-- at once take two numbers.
SELECT (COALESCE(max(number), 0) + 1)::int AS number FROM purchases WHERE company_id = $1;

-- name: CreatePurchase :one
-- Enters a purchase in a location of the company, from a supplier of it,
-- with no lines yet (total 0). created_by_name is the name the member goes
-- by in the company now: it stays when they leave.
INSERT INTO purchases (company_id, number, location_id, supplier_id, purchased_on, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('number'), sqlc.arg('location_id'), sqlc.arg('supplier_id'), sqlc.arg('purchased_on'),
        sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetPurchase :one
-- The company's purchase, in one of the locations given (the member's):
-- with its supplier's and location's names, what was paid with it (the
-- live payment linked to it, 0 when none), how many lines it has.
-- pgx.ErrNoRows when the company has none such in those locations, or
-- deleted it.
SELECT p.id, p.number, p.location_id, l.name AS location_name, p.supplier_id, s.name AS supplier_name,
       p.purchased_on, p.note, p.total, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       COALESCE((SELECT sp.amount FROM supplier_payments sp WHERE sp.purchase_id = p.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS items_count
FROM purchases p
JOIN locations l ON l.id = p.location_id
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListPurchases :many
-- A page of the company's purchases in the locations given, the newest
-- first (then the later entered), without the deleted; supplier_id keeps
-- one supplier's, NULL leaves the filter out. The columns are GetPurchase's.
SELECT p.id, p.number, p.location_id, l.name AS location_name, p.supplier_id, s.name AS supplier_name,
       p.purchased_on, p.note, p.total, p.created_at, p.updated_at,
       COALESCE(m.full_name, p.created_by_name) AS created_by_name,
       COALESCE((SELECT sp.amount FROM supplier_payments sp WHERE sp.purchase_id = p.id AND sp.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS items_count
FROM purchases p
JOIN locations l ON l.id = p.location_id
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR p.supplier_id = sqlc.narg('supplier_id')::bigint)
ORDER BY p.purchased_on DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPurchases :one
-- How many rows ListPurchases finds under the same filter, on all of its pages.
SELECT count(*) FROM purchases p
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL
  AND p.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR p.supplier_id = sqlc.narg('supplier_id')::bigint);

-- name: UpdatePurchase :one
-- An edit of the head: the supplier, the day and the note (NULL clears it),
-- and the moment of the edit. The number and the location stay.
-- pgx.ErrNoRows when the company has no such purchase, or deleted it.
UPDATE purchases
SET supplier_id = sqlc.arg('supplier_id'), purchased_on = sqlc.arg('purchased_on'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetPurchaseTotal :one
-- Writes the purchase's total as the sum of its lines (quantity × price),
-- 0 with no lines, and returns it.
UPDATE purchases
SET total = COALESCE((SELECT sum(i.quantity * i.price) FROM purchase_items i WHERE i.purchase_id = purchases.id), 0)
WHERE id = $1
RETURNING total;

-- name: DeletePurchase :one
-- Hides the purchase: nothing is removed, its number is never given again.
-- pgx.ErrNoRows when the company has no such purchase, or deleted it already.
UPDATE purchases SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: AddPurchaseItem :exec
-- Enters a line of the purchase: a product once per purchase (23505), a
-- quantity above zero and a price not below it (23514).
INSERT INTO purchase_items (purchase_id, product_id, quantity, price, position)
VALUES (sqlc.arg('purchase_id'), sqlc.arg('product_id'), sqlc.arg('quantity'), sqlc.arg('price'), sqlc.arg('position'));

-- name: ListPurchaseItems :many
-- The lines of the purchase in the order entered, each with its product's
-- name and unit and what it comes to.
SELECT i.product_id, pr.name, pr.unit, i.quantity, i.price, (i.quantity * i.price)::numeric(14,2) AS amount, i.position
FROM purchase_items i
JOIN products pr ON pr.id = i.product_id
WHERE i.purchase_id = $1
ORDER BY i.position, i.product_id;

-- name: DeletePurchaseItems :exec
-- Removes the lines of the purchase (an edit writes them anew).
DELETE FROM purchase_items WHERE purchase_id = $1;

-- name: EnsureStock :exec
-- Makes the product's stock row in the location, with nothing in it, when
-- there is none yet; a row is never removed.
INSERT INTO stock (company_id, location_id, product_id, quantity)
VALUES (sqlc.arg('company_id'), sqlc.arg('location_id'), sqlc.arg('product_id'), 0)
ON CONFLICT (location_id, product_id) DO NOTHING;

-- name: MoveStock :exec
-- Moves the product's stock in the location by added − removed: a purchase
-- adds its quantity, a deletion removes it, an edit passes both (the
-- difference). The row has to be there (EnsureStock). Below zero: 23514,
-- stock_quantity_check. (One INSERT ... ON CONFLICT DO UPDATE cannot do
-- this: the check runs on the proposed row before the conflict is seen.)
UPDATE stock
SET quantity = quantity + sqlc.arg('added')::numeric - sqlc.arg('removed')::numeric
WHERE location_id = sqlc.arg('location_id') AND product_id = sqlc.arg('product_id');
