-- name: CreateCustomerDropdown :one
INSERT INTO customer_dropdowns (company_id, name)
VALUES ($1, $2)
RETURNING *;

-- name: ListCustomerDropdowns :many
-- The company's dropdowns in the order they were made, without the deleted.
SELECT * FROM customer_dropdowns
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY id;
