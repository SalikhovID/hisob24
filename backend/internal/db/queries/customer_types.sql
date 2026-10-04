-- name: CreateCustomerType :one
-- A new type goes last among the company's.
INSERT INTO customer_types (company_id, name, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'),
        COALESCE((SELECT max(t.position) FROM customer_types t
                  WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL), 0) + 1)
RETURNING *;

-- name: ListCustomerTypes :many
-- The company's types in their order, without the deleted.
SELECT * FROM customer_types
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY position, id;

-- name: GetCustomerType :one
-- The company's type; pgx.ErrNoRows when it has none such, or deleted it.
SELECT * FROM customer_types
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
