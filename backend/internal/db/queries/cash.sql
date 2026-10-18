-- The finance documents (logic/finance.md, sections 4 and 5): what the
-- accounts hold, their statements, and the cash documents (an opening
-- balance of the cash, an expense or other income, a transfer between
-- accounts, a conversion) read as one shape.

-- name: ListAccountBalances :many
-- The company's live accounts, the active first and then in the order
-- added, each with what it holds in its own currency: what arrived (an
-- opening balance of the cash, other income, a customer's payment, a
-- transfer or a conversion into it) less what left (an expense, a
-- supplier's payment, a transfer or a conversion out of it). Nothing is
-- turned into another currency: a conversion leaves with its amount and
-- arrives with the amount that arrives (logic/finance.md, section 4).
SELECT b.id, b.name, b.currency_id, b.is_active,
       COALESCE(sum(CASE
           WHEN t.kind IN ('cash_opening', 'income', 'customer_payment') THEN t.total
           WHEN t.kind IN ('expense', 'supplier_payment') THEN -t.total
           WHEN t.kind = 'money_transfer' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.total END
           WHEN t.kind = 'conversion' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.to_total END
           ELSE 0 END), 0)::numeric(14,2) AS balance
FROM bank_accounts b
LEFT JOIN transactions t ON (t.bank_account_id = b.id OR t.to_bank_account_id = b.id) AND t.deleted_at IS NULL
WHERE b.company_id = sqlc.arg('company_id') AND b.deleted_at IS NULL
GROUP BY b.id
ORDER BY b.is_active DESC, b.id;

-- name: GetAccountBalance :one
-- One live account of the company with what it holds, as
-- ListAccountBalances tells it. pgx.ErrNoRows when there is none such.
SELECT b.id, b.name, b.currency_id, b.is_active,
       COALESCE(sum(CASE
           WHEN t.kind IN ('cash_opening', 'income', 'customer_payment') THEN t.total
           WHEN t.kind IN ('expense', 'supplier_payment') THEN -t.total
           WHEN t.kind = 'money_transfer' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.total END
           WHEN t.kind = 'conversion' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.to_total END
           ELSE 0 END), 0)::numeric(14,2) AS balance
FROM bank_accounts b
LEFT JOIN transactions t ON (t.bank_account_id = b.id OR t.to_bank_account_id = b.id) AND t.deleted_at IS NULL
WHERE b.id = sqlc.arg('id') AND b.company_id = sqlc.arg('company_id') AND b.deleted_at IS NULL
GROUP BY b.id;

-- name: ListAccountStatement :many
-- A page of the account's statement: every live document that names it,
-- as the source or the target, the newest first (then the later entered),
-- each with how it changed what the account holds (in the account's
-- currency, by the rule of ListAccountBalances) and what the account held
-- after it; the other side of each (the supplier, the customer by the
-- first text answer of their type and their phone, the category, the
-- other account: one of them is there); the document a payment was
-- entered with, and the order when that document is an order's.
WITH entries AS (
    SELECT t.id, t.kind, t.number, t.doc_at, t.note, t.linked_id, t.created_by, t.created_by_name, t.company_id,
           t.supplier_id, t.customer_id, t.category_id,
           CASE WHEN t.bank_account_id = sqlc.arg('account_id')::bigint THEN t.to_bank_account_id ELSE t.bank_account_id END AS other_account_id,
           (CASE
               WHEN t.kind IN ('cash_opening', 'income', 'customer_payment') THEN t.total
               WHEN t.kind IN ('expense', 'supplier_payment') THEN -t.total
               WHEN t.kind = 'money_transfer' THEN CASE WHEN t.bank_account_id = sqlc.arg('account_id')::bigint THEN -t.total ELSE t.total END
               WHEN t.kind = 'conversion' THEN CASE WHEN t.bank_account_id = sqlc.arg('account_id')::bigint THEN -t.total ELSE t.to_total END
               ELSE 0 END)::numeric(14,2) AS delta
    FROM transactions t
    WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
      AND (t.bank_account_id = sqlc.arg('account_id')::bigint OR t.to_bank_account_id = sqlc.arg('account_id')::bigint)
), running AS (
    SELECT e.*, (sum(e.delta) OVER (ORDER BY e.doc_at, e.id))::numeric(14,2) AS balance
    FROM entries e
)
SELECT r.id, r.kind, r.number, r.doc_at, r.delta, r.balance, r.linked_id, l.number AS linked_number, o.id AS order_id, o.number AS order_number,
       s.name AS supplier_name,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = cu.id
        WHERE f.type_id = cu.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       cu.phone AS customer_phone, c.name AS category_name, ob.name AS other_account_name,
       r.note, COALESCE(m.full_name, r.created_by_name) AS created_by_name
FROM running r
LEFT JOIN transactions l ON l.id = r.linked_id
LEFT JOIN orders o ON o.id = l.order_id
LEFT JOIN suppliers s ON s.id = r.supplier_id
LEFT JOIN customers cu ON cu.id = r.customer_id
LEFT JOIN finance_categories c ON c.id = r.category_id
LEFT JOIN bank_accounts ob ON ob.id = r.other_account_id
LEFT JOIN user_companies m ON m.user_phone = r.created_by AND m.company_id = r.company_id
ORDER BY r.doc_at DESC, r.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAccountStatement :one
-- How many rows ListAccountStatement finds, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND (t.bank_account_id = sqlc.arg('account_id')::bigint OR t.to_bank_account_id = sqlc.arg('account_id')::bigint);

-- name: GetCashDocument :one
-- The company's live cash document of one of the kinds: its account, the
-- account it goes to (a transfer, a conversion), its category (an expense,
-- an income), its amount and the amount that arrives (a conversion).
SELECT t.id, t.kind, t.number, t.doc_at, t.bank_account_id, b.name AS account_name, t.currency_id,
       t.to_bank_account_id, tb.name AS to_account_name, tb.currency_id AS to_currency_id,
       t.category_id, c.name AS category_name, t.total, t.to_total, t.note, t.created_at, t.updated_at,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN bank_accounts b ON b.id = t.bank_account_id
LEFT JOIN bank_accounts tb ON tb.id = t.to_bank_account_id
LEFT JOIN finance_categories c ON c.id = t.category_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.kind = ANY(sqlc.arg('kinds')::text[]) AND t.deleted_at IS NULL;

-- name: ListCashDocuments :many
-- A page of the company's live cash documents of the kinds, the newest
-- first; narrowed to an account (as the source or the target), a category
-- and a span of moments when asked. The columns are GetCashDocument's.
SELECT t.id, t.kind, t.number, t.doc_at, t.bank_account_id, b.name AS account_name, t.currency_id,
       t.to_bank_account_id, tb.name AS to_account_name, tb.currency_id AS to_currency_id,
       t.category_id, c.name AS category_name, t.total, t.to_total, t.note, t.created_at, t.updated_at,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN bank_accounts b ON b.id = t.bank_account_id
LEFT JOIN bank_accounts tb ON tb.id = t.to_bank_account_id
LEFT JOIN finance_categories c ON c.id = t.category_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = ANY(sqlc.arg('kinds')::text[]) AND t.deleted_at IS NULL
  AND (sqlc.narg('account_id')::bigint IS NULL OR t.bank_account_id = sqlc.narg('account_id')::bigint OR t.to_bank_account_id = sqlc.narg('account_id')::bigint)
  AND (sqlc.narg('category_id')::bigint IS NULL OR t.category_id = sqlc.narg('category_id')::bigint)
  AND (sqlc.narg('from_at')::timestamptz IS NULL OR t.doc_at >= sqlc.narg('from_at')::timestamptz)
  AND (sqlc.narg('to_at')::timestamptz IS NULL OR t.doc_at < sqlc.narg('to_at')::timestamptz)
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCashDocuments :one
-- How many rows ListCashDocuments finds, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = ANY(sqlc.arg('kinds')::text[]) AND t.deleted_at IS NULL
  AND (sqlc.narg('account_id')::bigint IS NULL OR t.bank_account_id = sqlc.narg('account_id')::bigint OR t.to_bank_account_id = sqlc.narg('account_id')::bigint)
  AND (sqlc.narg('category_id')::bigint IS NULL OR t.category_id = sqlc.narg('category_id')::bigint)
  AND (sqlc.narg('from_at')::timestamptz IS NULL OR t.doc_at >= sqlc.narg('from_at')::timestamptz)
  AND (sqlc.narg('to_at')::timestamptz IS NULL OR t.doc_at < sqlc.narg('to_at')::timestamptz);

-- name: CountAccountDocuments :one
-- How many live documents name the account, as the source or the target
-- (logic/finance.md, section 3: such an account is neither deleted nor
-- put in another currency).
SELECT count(*) FROM transactions t
WHERE (t.bank_account_id = sqlc.arg('account_id')::bigint OR t.to_bank_account_id = sqlc.arg('account_id')::bigint) AND t.deleted_at IS NULL;

-- name: CountCategoryDocuments :one
-- How many live documents are filed under the category (logic/finance.md,
-- section 6: such a category is not deleted).
SELECT count(*) FROM transactions t WHERE t.category_id = sqlc.arg('category_id')::bigint AND t.deleted_at IS NULL;
