-- name: CreateCustomer :one
-- Enters a customer. created_by_name is the name the member who enters it
-- goes by in the company now: it stays when they leave the company.
INSERT INTO customers (company_id, type_id, phone, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('type_id'), sqlc.arg('phone'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;
