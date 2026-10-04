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

-- name: RenameCustomerType :one
-- pgx.ErrNoRows when the company has no such type, or deleted it.
UPDATE customer_types SET name = sqlc.arg('name')
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCustomerType :one
-- Hides the type: nothing is removed. pgx.ErrNoRows when the company has no
-- such type, or deleted it already.
UPDATE customer_types SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: OrderCustomerTypes :exec
-- Puts the company's types in the order of ids: the first gets position 1.
-- An id that is not a live type of the company is passed over.
UPDATE customer_types t SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE t.id = n.id AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL;

-- name: AddCustomerField :one
-- Adds a field at the end of the company's type. pgx.ErrNoRows when the
-- company has no such type, or deleted it.
INSERT INTO customer_fields (company_id, type_id, label, kind, dropdown_id, required, is_unique, position)
SELECT t.company_id, t.id, sqlc.arg('label')::text, sqlc.arg('kind')::text, sqlc.narg('dropdown_id')::bigint,
       sqlc.arg('required')::boolean, sqlc.arg('is_unique')::boolean,
       COALESCE((SELECT max(f.position) FROM customer_fields f
                 WHERE f.type_id = t.id AND f.deleted_at IS NULL), 0) + 1
FROM customer_types t
WHERE t.id = sqlc.arg('type_id') AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
RETURNING *;

-- name: ListCustomerFields :many
-- Every field of the company's types, each type's in its order, without the
-- deleted ones (a deleted type's fields are deleted with it).
SELECT * FROM customer_fields
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY type_id, position, id;

-- name: GetCustomerField :one
-- A field of the company's type; pgx.ErrNoRows when the type has none such,
-- or it is deleted.
SELECT * FROM customer_fields
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL;

-- name: UpdateCustomerField :one
-- Changes a field's name and marks; a NULL argument leaves its column as it
-- is. The kind and the dropdown are never changed. pgx.ErrNoRows when the
-- type has no such field, or it is deleted.
UPDATE customer_fields
SET label = COALESCE(sqlc.narg('label'), label),
    required = COALESCE(sqlc.narg('required'), required),
    is_unique = COALESCE(sqlc.narg('is_unique'), is_unique)
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL
RETURNING *;

-- name: DeleteCustomerField :one
-- Hides a field of the company's type. pgx.ErrNoRows when the type has no
-- such field, or it is deleted already.
UPDATE customer_fields SET deleted_at = now()
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL
RETURNING id;
