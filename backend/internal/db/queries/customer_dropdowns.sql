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

-- name: RenameCustomerDropdown :one
-- pgx.ErrNoRows when the company has no such dropdown, or deleted it.
UPDATE customer_dropdowns SET name = sqlc.arg('name')
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCustomerDropdown :one
-- Hides the dropdown: nothing is removed. pgx.ErrNoRows when the company has
-- no such dropdown, or deleted it already.
UPDATE customer_dropdowns SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;
