-- name: NextNumber :one
-- The number the company's next document of the kind takes: one past the
-- highest so far, the deleted documents counted (a number is never given
-- twice). Run under the company's lock (LockCompanyCustomers), so two
-- documents entered at once take two numbers.
SELECT (COALESCE(max(number), 0) + 1)::int AS number FROM transactions WHERE company_id = $1 AND kind = $2;

-- name: CreateTransaction :one
-- Enters a document's head: its kind, number and moment, whichever of the
-- references the kind names, its currency and rate row, and its amount (0
-- for a goods document, whose lines set it). created_by_name is the name
-- the member goes by in the company now: it stays when they leave.
INSERT INTO transactions (company_id, kind, number, doc_at, location_id, to_location_id, supplier_id, customer_id, bank_account_id, to_bank_account_id,
                          category_id, linked_id, order_id, currency_id, currency_rate_id, total, to_total, note, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('kind'), sqlc.arg('number'), sqlc.arg('doc_at'), sqlc.narg('location_id'), sqlc.narg('to_location_id'),
        sqlc.narg('supplier_id'), sqlc.narg('customer_id'), sqlc.narg('bank_account_id'), sqlc.narg('to_bank_account_id'), sqlc.narg('category_id'),
        sqlc.narg('linked_id'), sqlc.narg('order_id'), sqlc.arg('currency_id'), sqlc.arg('currency_rate_id'), sqlc.arg('total'), sqlc.narg('to_total'), sqlc.narg('note'),
        sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetTransaction :one
-- The company's live document, whatever its kind. pgx.ErrNoRows when the
-- company has none such, or deleted it.
SELECT * FROM transactions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: UpdateTransaction :one
-- An edit of a document's head: its moment, whichever references the kind
-- lets change (the location of a goods document stays), its currency and
-- rate row, its note (NULL clears it), and the moment of the edit. The
-- amount is set apart (SetTransactionTotal, SetTransactionAmount).
-- pgx.ErrNoRows when the company has no such document, or deleted it.
UPDATE transactions
SET doc_at = sqlc.arg('doc_at'), to_location_id = sqlc.narg('to_location_id'), supplier_id = sqlc.narg('supplier_id'), customer_id = sqlc.narg('customer_id'),
    bank_account_id = sqlc.narg('bank_account_id'), to_bank_account_id = sqlc.narg('to_bank_account_id'), category_id = sqlc.narg('category_id'),
    currency_id = sqlc.arg('currency_id'), currency_rate_id = sqlc.arg('currency_rate_id'), note = sqlc.narg('note'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: SetTransactionTotal :one
-- Writes a goods document's total as the sum of its lines (quantity ×
-- price), 0 with no lines, and returns it.
UPDATE transactions
SET total = COALESCE((SELECT sum(i.quantity * i.price) FROM transaction_items i WHERE i.transaction_id = transactions.id), 0)
WHERE id = $1
RETURNING total;

-- name: SetTransactionAmount :exec
-- Writes a money document's amount (and a conversion's other amount).
UPDATE transactions SET total = sqlc.arg('total'), to_total = sqlc.narg('to_total') WHERE id = sqlc.arg('id');

-- name: DeleteTransaction :one
-- Hides the document: nothing is removed, its number is never given again.
-- pgx.ErrNoRows when the company has no such document, or deleted it already.
UPDATE transactions SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: AddTransactionItem :exec
-- Enters a line of a goods document: a product once per document (23505),
-- a quantity not below zero and a price not below it (23514); expected is
-- an inventory's stock at its moment.
INSERT INTO transaction_items (transaction_id, product_id, quantity, expected, price, position)
VALUES (sqlc.arg('transaction_id'), sqlc.arg('product_id'), sqlc.arg('quantity'), sqlc.narg('expected'), sqlc.narg('price'), sqlc.arg('position'));

-- name: ListTransactionItems :many
-- The lines of the document in the order entered, each with its product's
-- name, kind and unit and what it comes to (0 without a price).
SELECT i.product_id, pr.name, pr.kind, pr.unit, i.quantity, i.expected, i.price, (i.quantity * COALESCE(i.price, 0))::numeric(14,2) AS amount, i.position
FROM transaction_items i
JOIN products pr ON pr.id = i.product_id
WHERE i.transaction_id = $1
ORDER BY i.position, i.product_id;

-- name: DeleteTransactionItems :exec
-- Removes the lines of the document (an edit writes them anew).
DELETE FROM transaction_items WHERE transaction_id = $1;

-- name: GetPurchase :one
-- The company's purchase, in one of the locations given (the member's):
-- with its supplier's and location's names, its rate (of its currency, in
-- so'm), what it comes to in so'm, what was paid with it (the live payments
-- linked to it, each turned into the purchase's currency by its own rate
-- row; 0 when none), how many lines it has. pgx.ErrNoRows when the company
-- has none such in those locations, or deleted it.
SELECT t.id, t.number, l.id AS location_id, l.name AS location_name, s.id AS supplier_id, s.name AS supplier_name, t.doc_at, t.note, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, t.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = t.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
JOIN suppliers s ON s.id = t.supplier_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.kind = 'purchase' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListPurchases :many
-- A page of the company's purchases in the locations given, the newest
-- first (then the later entered), without the deleted; supplier_id keeps
-- one supplier's, NULL leaves the filter out. The columns are GetPurchase's.
SELECT t.id, t.number, l.id AS location_id, l.name AS location_name, s.id AS supplier_id, s.name AS supplier_name, t.doc_at, t.note, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, t.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = t.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
JOIN suppliers s ON s.id = t.supplier_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = 'purchase' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR t.supplier_id = sqlc.narg('supplier_id')::bigint)
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPurchases :one
-- How many rows ListPurchases finds under the same filter, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = 'purchase' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('supplier_id')::bigint IS NULL OR t.supplier_id = sqlc.narg('supplier_id')::bigint);

-- name: ListLinkedPayments :many
-- The live payments entered with the document, in the order entered: each
-- with its account's name, its amount in the account's currency.
SELECT p.id, b.id AS bank_account_id, b.name AS account_name, b.is_active AS account_active, p.total AS amount, p.currency_id
FROM transactions p
JOIN bank_accounts b ON b.id = p.bank_account_id
WHERE p.linked_id = sqlc.arg('linked_id')::bigint AND p.deleted_at IS NULL
ORDER BY p.id;

-- name: HideLinkedPayments :exec
-- Hides the live payments entered with the document: the document was
-- deleted, or is saved with other payments.
UPDATE transactions SET deleted_at = now() WHERE linked_id = sqlc.arg('linked_id')::bigint AND deleted_at IS NULL;

-- name: GetPayment :one
-- The supplier's payment in the company: its account, the number of the
-- purchase it was entered with (NULL for one entered on its own), its rate
-- (of its currency) and what it comes to in so'm. pgx.ErrNoRows when there
-- is none such, or it is deleted.
SELECT p.id, s.id AS supplier_id, p.linked_id AS purchase_id, l.number AS purchase_number, b.id AS bank_account_id, b.name AS account_name,
       p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN suppliers s ON s.id = p.supplier_id
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN transactions l ON l.id = p.linked_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.supplier_id = sqlc.arg('supplier_id')::bigint AND p.company_id = sqlc.arg('company_id')
  AND p.kind = 'supplier_payment' AND p.deleted_at IS NULL;

-- name: ListPayments :many
-- A page of the supplier's live payments, the newest first (then the later
-- entered). The columns are GetPayment's.
SELECT p.id, s.id AS supplier_id, p.linked_id AS purchase_id, l.number AS purchase_number, b.id AS bank_account_id, b.name AS account_name,
       p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN suppliers s ON s.id = p.supplier_id
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN transactions l ON l.id = p.linked_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.supplier_id = sqlc.arg('supplier_id')::bigint AND p.company_id = sqlc.arg('company_id') AND p.kind = 'supplier_payment' AND p.deleted_at IS NULL
ORDER BY p.doc_at DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPayments :one
-- How many rows ListPayments finds, on all of its pages.
SELECT count(*) FROM transactions p
WHERE p.supplier_id = sqlc.arg('supplier_id')::bigint AND p.company_id = sqlc.arg('company_id') AND p.kind = 'supplier_payment' AND p.deleted_at IS NULL;

-- name: CountSupplierDocuments :one
-- How many live documents name the supplier: one with any is not deleted.
SELECT count(*) FROM transactions WHERE supplier_id = sqlc.arg('supplier_id')::bigint AND deleted_at IS NULL;

-- name: CountLocationDocuments :one
-- How many live documents stand in the location, a transfer's other end
-- counted too: one with any is not deleted (logic/locations.md, section 7).
SELECT count(*) FROM transactions
WHERE (location_id = sqlc.arg('location_id')::bigint OR to_location_id = sqlc.arg('location_id')::bigint) AND deleted_at IS NULL;

-- name: CountProductDocuments :one
-- How many live documents hold the product, in any location: one held is
-- not deleted (logic/products.md, section 4).
SELECT count(*) FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id
WHERE i.product_id = $1 AND t.deleted_at IS NULL;

-- name: ListProductPurchases :many
-- A page of the live purchase lines of the product in the locations given,
-- the newest purchase first: the purchase, its supplier, location and
-- currency, the line's quantity, price and what it comes to.
SELECT t.id AS purchase_id, t.number, t.doc_at, s.id AS supplier_id, s.name AS supplier_name, l.id AS location_id, l.name AS location_name, t.currency_id,
       i.quantity, i.price, (i.quantity * COALESCE(i.price, 0))::numeric(14,2) AS amount
FROM transaction_items i
JOIN transactions t ON t.id = i.transaction_id
JOIN suppliers s ON s.id = t.supplier_id
JOIN locations l ON l.id = t.location_id
WHERE i.product_id = sqlc.arg('product_id') AND t.kind = 'purchase' AND t.deleted_at IS NULL AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountProductPurchaseLines :one
-- How many rows ListProductPurchases finds, on all of its pages.
SELECT count(*) FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id
WHERE i.product_id = sqlc.arg('product_id') AND t.kind = 'purchase' AND t.deleted_at IS NULL AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: GetGoodsDocument :one
-- A goods document of the kind (a transfer, an inventory or an opening
-- stock) of the company, standing in one of the locations given (the
-- member's; a transfer counts by either end): its locations' names, its
-- currency and rate, what it comes to (an opening stock) in its currency
-- and in so'm, how many lines it has. pgx.ErrNoRows when the company has
-- none such there, or deleted it.
SELECT t.id, t.kind, t.number, l.id AS location_id, l.name AS location_name, t.to_location_id, tl.name AS to_location_name, t.doc_at, t.note,
       t.currency_id, (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
LEFT JOIN locations tl ON tl.id = t.to_location_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.kind = sqlc.arg('kind') AND t.deleted_at IS NULL
  AND (t.location_id = ANY(sqlc.arg('location_ids')::bigint[]) OR t.to_location_id = ANY(sqlc.arg('location_ids')::bigint[]));

-- name: ListGoodsDocuments :many
-- A page of the company's goods documents of the kind standing in the
-- locations given (a transfer: either end), the newest first (then the
-- later entered), without the deleted. The columns are GetGoodsDocument's.
SELECT t.id, t.kind, t.number, l.id AS location_id, l.name AS location_name, t.to_location_id, tl.name AS to_location_name, t.doc_at, t.note,
       t.currency_id, (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
LEFT JOIN locations tl ON tl.id = t.to_location_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = sqlc.arg('kind') AND t.deleted_at IS NULL
  AND (t.location_id = ANY(sqlc.arg('location_ids')::bigint[]) OR t.to_location_id = ANY(sqlc.arg('location_ids')::bigint[]))
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountGoodsDocuments :one
-- How many rows ListGoodsDocuments finds under the same filter, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = sqlc.arg('kind') AND t.deleted_at IS NULL
  AND (t.location_id = ANY(sqlc.arg('location_ids')::bigint[]) OR t.to_location_id = ANY(sqlc.arg('location_ids')::bigint[]));

-- name: GetOpening :one
-- An opening balance of the supplier (a debt or an advance): its amount in
-- its currency, its rate, and the amount in so'm. pgx.ErrNoRows when there
-- is none such, or it is deleted.
SELECT t.id, t.kind, s.id AS supplier_id, t.total AS amount, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       t.doc_at, t.note, t.created_at, t.updated_at, COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN suppliers s ON s.id = t.supplier_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('supplier_debt', 'supplier_prepay') AND t.deleted_at IS NULL;

-- name: ListOpenings :many
-- A page of the supplier's live opening balances, the newest first (then
-- the later entered). The columns are GetOpening's.
SELECT t.id, t.kind, s.id AS supplier_id, t.total AS amount, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       t.doc_at, t.note, t.created_at, t.updated_at, COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN suppliers s ON s.id = t.supplier_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('supplier_debt', 'supplier_prepay') AND t.deleted_at IS NULL
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountOpenings :one
-- How many rows ListOpenings finds, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.supplier_id = sqlc.arg('supplier_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('supplier_debt', 'supplier_prepay') AND t.deleted_at IS NULL;

-- name: GetSale :one
-- The company's sale, in one of the locations given (the member's): with
-- its location's name, its customer (none for a retail sale) by the first
-- text answer of the customer's type (the name) and the phone, its rate (of
-- its currency, in so'm), what it comes to in so'm, what was paid with it
-- (the live payments linked to it, each turned into the sale's currency by
-- its own rate row; 0 when none), how many lines it has. pgx.ErrNoRows when
-- the company has none such in those locations, or deleted it
-- (logic/sales.md, section 3).
SELECT t.id, t.number, l.id AS location_id, l.name AS location_name, t.customer_id, c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       t.doc_at, t.note, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, t.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = t.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
LEFT JOIN customers c ON c.id = t.customer_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.kind = 'sale' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListSales :many
-- A page of the company's sales in the locations given, the newest first
-- (then the later entered), without the deleted; customer_id keeps one
-- customer's, NULL leaves the filter out. The columns are GetSale's.
SELECT t.id, t.number, l.id AS location_id, l.name AS location_name, t.customer_id, c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       t.doc_at, t.note, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, t.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = t.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       (SELECT count(*) FROM transaction_items i WHERE i.transaction_id = t.id) AS items_count,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name, t.created_at, t.updated_at
FROM transactions t
JOIN locations l ON l.id = t.location_id
LEFT JOIN customers c ON c.id = t.customer_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = 'sale' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('customer_id')::bigint IS NULL OR t.customer_id = sqlc.narg('customer_id')::bigint)
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSales :one
-- How many rows ListSales finds under the same filter, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.company_id = sqlc.arg('company_id') AND t.kind = 'sale' AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('customer_id')::bigint IS NULL OR t.customer_id = sqlc.narg('customer_id')::bigint);

-- name: GetOrderDocument :one
-- The order's live document (logic/orders.md, 4.3): its currency and rate
-- (of its currency, in so'm), its price (total) in its currency and in
-- so'm, what was paid for it (the live payments linked to it, each turned
-- into its currency by its own rate row; 0 with none). pgx.ErrNoRows when
-- the order has none, or it is hidden.
SELECT t.id, t.number, t.doc_at, t.currency_id, t.currency_rate_id, t.note,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       t.total, convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS total_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, t.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = t.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid
FROM transactions t
JOIN currency_rates cr ON cr.id = t.currency_rate_id
WHERE t.order_id = sqlc.arg('order_id')::bigint AND t.company_id = sqlc.arg('company_id') AND t.kind = 'order' AND t.deleted_at IS NULL;

-- name: ListOrderPayments :many
-- The live payments linked to the order's document, the newest first
-- (then the later entered): each with its account, its amount in the
-- account's currency, its rate (of that currency) and what it comes to in
-- so'm.
SELECT p.id, p.customer_id, b.id AS bank_account_id, b.name AS account_name, p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.linked_id = sqlc.arg('linked_id')::bigint AND p.kind = 'customer_payment' AND p.deleted_at IS NULL
ORDER BY p.doc_at DESC, p.id DESC;

-- name: GetOrderPayment :one
-- One of the live payments linked to the order's document, by its id. The
-- columns are ListOrderPayments'. pgx.ErrNoRows when the document has none
-- such, or it is hidden.
SELECT p.id, p.customer_id, b.id AS bank_account_id, b.name AS account_name, p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.linked_id = sqlc.arg('linked_id')::bigint AND p.kind = 'customer_payment' AND p.deleted_at IS NULL;

-- name: GetCustomerPayment :one
-- The customer's payment in the company: its account, the sale it was
-- entered with and its number, or the order it was entered for
-- (logic/orders.md, 4.3), NULL for one entered on its own; its rate (of
-- its currency) and what it comes to in so'm. pgx.ErrNoRows when there is
-- none such, or it is deleted (logic/sales.md, section 5).
SELECT p.id, c.id AS customer_id, l.id AS sale_id, l.number AS sale_number, o.id AS order_id, b.id AS bank_account_id, b.name AS account_name,
       p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN customers c ON c.id = p.customer_id
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN transactions l ON l.id = p.linked_id AND l.kind = 'sale'
LEFT JOIN transactions lo ON lo.id = p.linked_id AND lo.kind = 'order'
LEFT JOIN orders o ON o.id = lo.order_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.id = sqlc.arg('id') AND p.customer_id = sqlc.arg('customer_id')::bigint AND p.company_id = sqlc.arg('company_id')
  AND p.kind = 'customer_payment' AND p.deleted_at IS NULL;

-- name: ListCustomerPayments :many
-- A page of the customer's live payments, the newest first (then the later
-- entered). The columns are GetCustomerPayment's.
SELECT p.id, c.id AS customer_id, l.id AS sale_id, l.number AS sale_number, o.id AS order_id, b.id AS bank_account_id, b.name AS account_name,
       p.total AS amount, p.currency_id,
       (CASE p.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(p.total, p.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       p.doc_at, p.note, p.created_at, p.updated_at, COALESCE(m.full_name, p.created_by_name) AS created_by_name
FROM transactions p
JOIN customers c ON c.id = p.customer_id
JOIN bank_accounts b ON b.id = p.bank_account_id
JOIN currency_rates cr ON cr.id = p.currency_rate_id
LEFT JOIN transactions l ON l.id = p.linked_id AND l.kind = 'sale'
LEFT JOIN transactions lo ON lo.id = p.linked_id AND lo.kind = 'order'
LEFT JOIN orders o ON o.id = lo.order_id
LEFT JOIN user_companies m ON m.user_phone = p.created_by AND m.company_id = p.company_id
WHERE p.customer_id = sqlc.arg('customer_id')::bigint AND p.company_id = sqlc.arg('company_id') AND p.kind = 'customer_payment' AND p.deleted_at IS NULL
ORDER BY p.doc_at DESC, p.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCustomerPayments :one
-- How many rows ListCustomerPayments finds, on all of its pages.
SELECT count(*) FROM transactions p
WHERE p.customer_id = sqlc.arg('customer_id')::bigint AND p.company_id = sqlc.arg('company_id') AND p.kind = 'customer_payment' AND p.deleted_at IS NULL;

-- name: GetCustomerOpening :one
-- An opening balance of the customer (a debt or an advance): its amount in
-- its currency, its rate, and the amount in so'm. pgx.ErrNoRows when there
-- is none such, or it is deleted.
SELECT t.id, t.kind, c.id AS customer_id, t.total AS amount, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       t.doc_at, t.note, t.created_at, t.updated_at, COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN customers c ON c.id = t.customer_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.customer_id = sqlc.arg('customer_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('customer_debt', 'customer_prepay') AND t.deleted_at IS NULL;

-- name: ListCustomerOpenings :many
-- A page of the customer's live opening balances, the newest first (then
-- the later entered). The columns are GetCustomerOpening's.
SELECT t.id, t.kind, c.id AS customer_id, t.total AS amount, t.currency_id,
       (CASE t.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END)::numeric(14,4) AS rate,
       convert_amount(t.total, t.currency_id, 1, cr)::numeric(14,2) AS amount_uzs,
       t.doc_at, t.note, t.created_at, t.updated_at, COALESCE(m.full_name, t.created_by_name) AS created_by_name
FROM transactions t
JOIN customers c ON c.id = t.customer_id
JOIN currency_rates cr ON cr.id = t.currency_rate_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
WHERE t.customer_id = sqlc.arg('customer_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('customer_debt', 'customer_prepay') AND t.deleted_at IS NULL
ORDER BY t.doc_at DESC, t.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCustomerOpenings :one
-- How many rows ListCustomerOpenings finds, on all of its pages.
SELECT count(*) FROM transactions t
WHERE t.customer_id = sqlc.arg('customer_id')::bigint AND t.company_id = sqlc.arg('company_id')
  AND t.kind IN ('customer_debt', 'customer_prepay') AND t.deleted_at IS NULL;

-- name: CountCustomerDocuments :one
-- How many live documents name the customer: one with any is not deleted
-- (logic/sales.md, section 7). A retail sale's payment names none.
SELECT count(*) FROM transactions WHERE customer_id = sqlc.arg('customer_id')::bigint AND deleted_at IS NULL;
