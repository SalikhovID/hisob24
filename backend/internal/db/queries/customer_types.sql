-- name: CreateCustomerType :one
-- A new type goes last among the company's.
INSERT INTO customer_types (company_id, name, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'),
        COALESCE((SELECT max(t.position) FROM customer_types t
                  WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL), 0) + 1)
RETURNING *;
