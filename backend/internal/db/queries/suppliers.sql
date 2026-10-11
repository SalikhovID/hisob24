-- name: CreateSupplier :one
-- Enters a supplier. created_by_name is the name the member who enters it
-- goes by in the company now: it stays when they leave. The name is one
-- live supplier's in the company (23505, whatever the case).
INSERT INTO suppliers (company_id, name, phone, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.narg('phone'), sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetSupplier :one
-- The company's supplier with its balance, in so'm by each document's own
-- rate row (logic/warehouse.md, section 6): what its live purchases come
-- to, what its live payments come to, and what is owed (the purchases and
-- the opening debts less the payments and the opening advances; an advance
-- when below zero). pgx.ErrNoRows when the company has none such, or
-- deleted it.
SELECT s.id, s.name, s.phone, s.note, s.is_active, s.created_at, s.updated_at,
       COALESCE(m.full_name, s.created_by_name) AS created_by_name,
       t.purchases_total, t.payments_total, t.balance
FROM suppliers s
LEFT JOIN user_companies m ON m.user_phone = s.created_by AND m.company_id = s.company_id
CROSS JOIN LATERAL (
    SELECT COALESCE(sum(CASE WHEN d.kind = 'purchase' THEN convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS purchases_total,
           COALESCE(sum(CASE WHEN d.kind = 'supplier_payment' THEN convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS payments_total,
           COALESCE(sum(CASE WHEN d.kind IN ('purchase', 'supplier_debt') THEN convert_amount(d.total, d.currency_id, 1, cr)
                             ELSE -convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS balance
    FROM transactions d
    JOIN currency_rates cr ON cr.id = d.currency_rate_id
    WHERE d.supplier_id = s.id AND d.deleted_at IS NULL
) t
WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL;

-- name: ListSuppliers :many
-- A page of the company's suppliers, the active or the inactive ones, by
-- name whatever the case, without the deleted, each with its balance.
-- search, escaped for ILIKE, is looked for in the name; digits, the digits
-- of a search that is a number (always with search), in the phone too. A
-- NULL search leaves the filter out.
SELECT s.id, s.name, s.phone, s.note, s.is_active, s.created_at, s.updated_at,
       COALESCE(m.full_name, s.created_by_name) AS created_by_name,
       t.purchases_total, t.payments_total, t.balance
FROM suppliers s
LEFT JOIN user_companies m ON m.user_phone = s.created_by AND m.company_id = s.company_id
CROSS JOIN LATERAL (
    SELECT COALESCE(sum(CASE WHEN d.kind = 'purchase' THEN convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS purchases_total,
           COALESCE(sum(CASE WHEN d.kind = 'supplier_payment' THEN convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS payments_total,
           COALESCE(sum(CASE WHEN d.kind IN ('purchase', 'supplier_debt') THEN convert_amount(d.total, d.currency_id, 1, cr)
                             ELSE -convert_amount(d.total, d.currency_id, 1, cr) END), 0)::numeric(14,2) AS balance
    FROM transactions d
    JOIN currency_rates cr ON cr.id = d.currency_rate_id
    WHERE d.supplier_id = s.id AND d.deleted_at IS NULL
) t
WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL AND s.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR s.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR (sqlc.narg('digits')::text IS NOT NULL AND s.phone LIKE '%' || sqlc.narg('digits')::text || '%'))
ORDER BY lower(s.name), s.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSuppliers :one
-- How many rows ListSuppliers finds under the same filter, on all of its pages.
SELECT count(*) FROM suppliers s
WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL AND s.is_active = sqlc.arg('is_active')
  AND (sqlc.narg('search')::text IS NULL
       OR s.name ILIKE '%' || sqlc.narg('search')::text || '%'
       OR (sqlc.narg('digits')::text IS NOT NULL AND s.phone LIKE '%' || sqlc.narg('digits')::text || '%'));

-- name: UpdateSupplier :one
-- An edit: every field as it is now (NULL clears an optional one), and the
-- moment of the edit. pgx.ErrNoRows when the company has no such supplier,
-- or deleted it; 23505 when the name is another's.
UPDATE suppliers
SET name = sqlc.arg('name'), phone = sqlc.narg('phone'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetSupplierActive :one
-- Turns a supplier off (offered to no new purchase) or on again.
-- pgx.ErrNoRows when the company has no such supplier, or deleted it.
UPDATE suppliers SET is_active = sqlc.arg('is_active'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteSupplier :one
-- Hides the supplier: nothing is removed, and its name is free again.
-- pgx.ErrNoRows when the company has no such supplier, or deleted it already.
UPDATE suppliers SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: SupplierStanding :one
-- Whether the company's live supplier is active; pgx.ErrNoRows when the
-- company has none such, or deleted it (a purchase may not name it).
SELECT is_active FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
