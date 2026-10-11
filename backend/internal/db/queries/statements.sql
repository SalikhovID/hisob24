-- name: ListSupplierBalanceByCurrency :many
-- What is owed the supplier in each currency its live documents are in,
-- without turning anything into so'm: the purchases and the opening debts
-- less the payments and the opening advances; a currency that comes to 0
-- is left out.
SELECT t.currency_id, sum(CASE WHEN t.kind IN ('purchase', 'supplier_debt') THEN t.total ELSE -t.total END)::numeric(14,2) AS amount
FROM transactions t
WHERE t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.deleted_at IS NULL
GROUP BY t.currency_id
HAVING sum(CASE WHEN t.kind IN ('purchase', 'supplier_debt') THEN t.total ELSE -t.total END) <> 0
ORDER BY t.currency_id;

-- name: ListSupplierStatement :many
-- A page of the supplier's statement: its live documents, the newest first
-- (then the later entered), each with its amount in so'm by its own rate
-- row, how it changed what is owed (a purchase or an opening debt adds, a
-- payment or an opening advance takes away) and what was owed after it; a
-- payment entered with a purchase names the purchase's number.
WITH entries AS (
    SELECT t.id, t.kind, t.number, t.doc_at, t.total, t.currency_id, t.note, t.linked_id, t.created_by, t.created_by_name, t.company_id,
           convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
           (CASE WHEN t.kind IN ('purchase', 'supplier_debt') THEN 1 ELSE -1 END)::numeric AS sign
    FROM transactions t
    JOIN currency_rates cr ON cr.id = t.currency_rate_id
    WHERE t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
), running AS (
    SELECT e.id, e.kind, e.number, e.doc_at, e.total, e.currency_id, e.note, e.linked_id, e.created_by, e.created_by_name, e.company_id, e.amount_uzs,
           (e.sign * e.amount_uzs)::numeric(14,2) AS delta_uzs,
           (sum(e.sign * e.amount_uzs) OVER (ORDER BY e.doc_at, e.id))::numeric(14,2) AS balance_uzs
    FROM entries e
)
SELECT r.id, r.kind, r.number, r.doc_at, r.total AS amount, r.currency_id, r.amount_uzs, r.delta_uzs, r.balance_uzs, r.linked_id,
       l.number AS linked_number, r.note, COALESCE(m.full_name, r.created_by_name) AS created_by_name
FROM running r
LEFT JOIN transactions l ON l.id = r.linked_id
LEFT JOIN user_companies m ON m.user_phone = r.created_by AND m.company_id = r.company_id
ORDER BY r.doc_at DESC, r.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSupplierStatement :one
-- How many rows ListSupplierStatement finds, on all of its pages.
SELECT count(*) FROM transactions t WHERE t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL;
