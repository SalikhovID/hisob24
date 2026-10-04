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

-- name: AddCustomerDropdownOption :one
-- Adds an option at the end of the company's dropdown. pgx.ErrNoRows when
-- the company has no such dropdown, or deleted it.
INSERT INTO customer_dropdown_options (dropdown_id, label, position)
SELECT d.id, sqlc.arg('label')::text,
       COALESCE((SELECT max(o.position) FROM customer_dropdown_options o
                 WHERE o.dropdown_id = d.id AND o.deleted_at IS NULL), 0) + 1
FROM customer_dropdowns d
WHERE d.id = sqlc.arg('dropdown_id') AND d.company_id = sqlc.arg('company_id') AND d.deleted_at IS NULL
RETURNING *;

-- name: ListCustomerDropdownOptions :many
-- Every option of the company's dropdowns, each dropdown's in its order,
-- without the deleted ones and those of deleted dropdowns.
SELECT o.* FROM customer_dropdown_options o
JOIN customer_dropdowns d ON d.id = o.dropdown_id
WHERE d.company_id = $1 AND d.deleted_at IS NULL AND o.deleted_at IS NULL
ORDER BY o.dropdown_id, o.position, o.id;
