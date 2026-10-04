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
