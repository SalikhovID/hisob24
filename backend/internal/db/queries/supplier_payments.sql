-- name: CreatePayment :one
-- Enters a payment to the supplier; purchase_id links the one entered with
-- a purchase. created_by_name stays when the member leaves. 23514 on an
-- amount not above zero; 23505 on a second live payment of a purchase.
INSERT INTO supplier_payments (company_id, supplier_id, purchase_id, amount, paid_on, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('supplier_id'), sqlc.narg('purchase_id'), sqlc.arg('amount'), sqlc.arg('paid_on'),
        sqlc.narg('note'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetPayment :one
-- The supplier's payment in the company, with the number of the purchase it
-- was entered with (NULL for one entered on its own). pgx.ErrNoRows when
-- there is none such, or it is deleted.
SELECT sp.id, sp.supplier_id, sp.purchase_id, p.number AS purchase_number, sp.amount, sp.paid_on, sp.note, sp.created_at, sp.updated_at,
       COALESCE(m.full_name, sp.created_by_name) AS created_by_name
FROM supplier_payments sp
LEFT JOIN purchases p ON p.id = sp.purchase_id
LEFT JOIN user_companies m ON m.user_phone = sp.created_by AND m.company_id = sp.company_id
WHERE sp.id = $1 AND sp.supplier_id = $2 AND sp.company_id = $3 AND sp.deleted_at IS NULL;

-- name: ListPayments :many
-- A page of the supplier's live payments, the newest first (then the later
-- entered). The columns are GetPayment's.
SELECT sp.id, sp.supplier_id, sp.purchase_id, p.number AS purchase_number, sp.amount, sp.paid_on, sp.note, sp.created_at, sp.updated_at,
       COALESCE(m.full_name, sp.created_by_name) AS created_by_name
FROM supplier_payments sp
LEFT JOIN purchases p ON p.id = sp.purchase_id
LEFT JOIN user_companies m ON m.user_phone = sp.created_by AND m.company_id = sp.company_id
WHERE sp.supplier_id = sqlc.arg('supplier_id') AND sp.company_id = sqlc.arg('company_id') AND sp.deleted_at IS NULL
ORDER BY sp.paid_on DESC, sp.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPayments :one
-- How many rows ListPayments finds, on all of its pages.
SELECT count(*) FROM supplier_payments sp
WHERE sp.supplier_id = sqlc.arg('supplier_id') AND sp.company_id = sqlc.arg('company_id') AND sp.deleted_at IS NULL;

-- name: UpdatePayment :one
-- An edit of a payment entered on its own: the amount, the day and the note
-- (NULL clears it). pgx.ErrNoRows when the company has none such, or
-- deleted it. (A linked one is refused by the service before this.)
UPDATE supplier_payments
SET amount = sqlc.arg('amount'), paid_on = sqlc.arg('paid_on'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeletePayment :one
-- Hides the payment. pgx.ErrNoRows when the company has none such, or
-- deleted it already.
UPDATE supplier_payments SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: GetPurchasePayment :one
-- The live payment entered with the purchase; pgx.ErrNoRows when there is
-- none.
SELECT * FROM supplier_payments WHERE purchase_id = sqlc.arg('purchase_id')::bigint AND deleted_at IS NULL;

-- name: UpdatePurchasePayment :exec
-- The payment entered with the purchase follows an edit of it: the
-- purchase's supplier, the amount paid and the purchase's day.
UPDATE supplier_payments
SET supplier_id = sqlc.arg('supplier_id'), amount = sqlc.arg('amount'), paid_on = sqlc.arg('paid_on'), updated_at = now()
WHERE purchase_id = sqlc.arg('purchase_id')::bigint AND deleted_at IS NULL;

-- name: DeletePurchasePayment :exec
-- Hides the payment entered with the purchase, when there is one: the
-- purchase was deleted, or is paid nothing now.
UPDATE supplier_payments SET deleted_at = now() WHERE purchase_id = sqlc.arg('purchase_id')::bigint AND deleted_at IS NULL;
