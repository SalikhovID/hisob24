-- name: CreateCustomerDropdown :one
INSERT INTO customer_dropdowns (company_id, name)
VALUES ($1, $2)
RETURNING *;

-- name: ListCustomerDropdowns :many
-- The company's dropdowns in the order they were made, without the deleted.
SELECT * FROM customer_dropdowns
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY id;

-- name: GetCustomerDropdown :one
-- The company's dropdown; pgx.ErrNoRows when it has none such, or deleted it.
SELECT * FROM customer_dropdowns
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
