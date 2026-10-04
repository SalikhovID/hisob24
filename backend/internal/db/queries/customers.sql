-- name: CreateCustomer :one
-- Enters a customer. created_by_name is the name the member who enters it
-- goes by in the company now: it stays when they leave the company.
INSERT INTO customers (company_id, type_id, phone, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('type_id'), sqlc.arg('phone'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetCustomer :one
-- The company's customer; pgx.ErrNoRows when it has none such, or deleted
-- it. created_by_name is the name the member who entered it goes by in the
-- company now; once they have left it (or go by no name), the name of then.
SELECT c.id, c.type_id, c.phone, c.created_at, c.updated_at,
       COALESCE(m.full_name, c.created_by_name) AS created_by_name
FROM customers c
LEFT JOIN user_companies m ON m.user_phone = c.created_by AND m.company_id = c.company_id
WHERE c.id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL;

-- name: GetCustomerByPhone :one
-- The company's customer with the number: a number is one customer's.
-- pgx.ErrNoRows when it is free, as a deleted customer's is.
SELECT id FROM customers
WHERE company_id = $1 AND phone = $2 AND deleted_at IS NULL;

-- name: UpdateCustomer :one
-- An edit: the customer's number as it is now, and the moment of the edit.
-- pgx.ErrNoRows when the company has no such customer, or deleted it.
UPDATE customers SET phone = sqlc.arg('phone'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING updated_at;

-- name: DeleteCustomer :one
-- Hides the customer: nothing is removed, and its number is free again.
-- pgx.ErrNoRows when the company has no such customer, or deleted it already.
UPDATE customers SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: AddCustomerValue :exec
-- One row of a customer's answers: a text, a whole number, or an option
-- chosen. A choice of several options is a row for each.
INSERT INTO customer_values (customer_id, field_id, option_id, text_value, int_value)
VALUES (sqlc.arg('customer_id'), sqlc.arg('field_id'), sqlc.narg('option_id'), sqlc.narg('text_value'), sqlc.narg('int_value'));

-- name: DeleteCustomerValues :exec
-- Clears a customer's answers: an edit writes them anew. What they were
-- stays in the customer's history.
DELETE FROM customer_values WHERE customer_id = $1;

-- name: ListCustomerValues :many
-- The answers of the customers named: each customer's in the order of its
-- type's fields, the options of one field in the order of their dropdown.
-- kind tells how a field's rows are read.
SELECT v.customer_id, v.field_id, f.kind, v.option_id, v.text_value, v.int_value
FROM customer_values v
JOIN customer_fields f ON f.id = v.field_id
LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
WHERE v.customer_id = ANY(sqlc.arg('customer_ids')::bigint[])
ORDER BY v.customer_id, f.position, f.id, o.position, o.id;

-- name: ListCustomers :many
-- A page of the company's customers, the newest first, without the deleted.
-- type_id keeps one type. search, escaped for ILIKE, is looked for in the
-- text answers, in any case; digits, the digits of a search that is a number,
-- in the phone and in the whole number answers. The names of the options are
-- not searched. A NULL argument leaves its filter out.
SELECT c.id, c.type_id, c.phone, c.created_at, c.updated_at,
       COALESCE(m.full_name, c.created_by_name) AS created_by_name
FROM customers c
LEFT JOIN user_companies m ON m.user_phone = c.created_by AND m.company_id = c.company_id
WHERE c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL
  AND (sqlc.narg('type_id')::bigint IS NULL OR c.type_id = sqlc.narg('type_id')::bigint)
  AND (sqlc.narg('search')::text IS NULL
       OR c.phone LIKE '%' || sqlc.narg('digits')::text || '%'
       OR EXISTS (SELECT 1 FROM customer_values v
                  WHERE v.customer_id = c.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%')))
ORDER BY c.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');
