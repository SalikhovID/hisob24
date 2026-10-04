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

-- name: UpdateCustomerDropdownOption :one
-- Renames an option of the company's dropdown, or turns it off or on; a NULL
-- argument leaves its column as it is. pgx.ErrNoRows when the dropdown has
-- no such option, or it is deleted.
UPDATE customer_dropdown_options o
SET label = COALESCE(sqlc.narg('label'), o.label),
    is_active = COALESCE(sqlc.narg('is_active'), o.is_active)
FROM customer_dropdowns d
WHERE o.id = sqlc.arg('id') AND o.dropdown_id = sqlc.arg('dropdown_id') AND d.id = o.dropdown_id
  AND d.company_id = sqlc.arg('company_id') AND d.deleted_at IS NULL AND o.deleted_at IS NULL
RETURNING o.*;

-- name: DeleteCustomerDropdownOption :one
-- Hides an option of the company's dropdown. pgx.ErrNoRows when the dropdown
-- has no such option, or it is deleted already.
UPDATE customer_dropdown_options o SET deleted_at = now()
FROM customer_dropdowns d
WHERE o.id = sqlc.arg('id') AND o.dropdown_id = sqlc.arg('dropdown_id') AND d.id = o.dropdown_id
  AND d.company_id = sqlc.arg('company_id') AND d.deleted_at IS NULL AND o.deleted_at IS NULL
RETURNING o.id;

-- name: ListCustomerDropdownOptionIDs :many
-- The dropdown's options in their order: what a new order has to name, all
-- of them and nothing else.
SELECT id FROM customer_dropdown_options
WHERE dropdown_id = $1 AND deleted_at IS NULL
ORDER BY position, id;

-- name: OrderCustomerDropdownOptions :exec
-- Puts the dropdown's options in the order of ids: the first gets position
-- 1. An id that is not a live option of the dropdown is passed over.
UPDATE customer_dropdown_options o SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE o.id = n.id AND o.dropdown_id = sqlc.arg('dropdown_id') AND o.deleted_at IS NULL;
