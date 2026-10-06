-- name: CreateTaskType :one
-- A new type goes last among the company's.
INSERT INTO task_types (company_id, name, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'),
        COALESCE((SELECT max(t.position) FROM task_types t
                  WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL), 0) + 1)
RETURNING *;

-- name: ListTaskTypes :many
-- The company's types in their order, without the deleted.
SELECT * FROM task_types
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY position, id;

-- name: GetTaskType :one
-- The company's type; pgx.ErrNoRows when it has none such, or deleted it.
SELECT * FROM task_types
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: RenameTaskType :one
-- pgx.ErrNoRows when the company has no such type, or deleted it.
UPDATE task_types SET name = sqlc.arg('name')
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteTaskType :one
-- Hides the type: nothing is removed. pgx.ErrNoRows when the company has no
-- such type, or deleted it already.
UPDATE task_types SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: OrderTaskTypes :exec
-- Puts the company's types in the order of ids: the first gets position 1.
-- An id that is not a live type of the company is passed over.
UPDATE task_types t SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE t.id = n.id AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL;

-- name: AddTaskField :one
-- Adds a field at the end of the company's type. pgx.ErrNoRows when the
-- company has no such type, or deleted it.
INSERT INTO task_fields (company_id, type_id, label, kind, dropdown_id, required, position)
SELECT t.company_id, t.id, sqlc.arg('label')::text, sqlc.arg('kind')::text, sqlc.narg('dropdown_id')::bigint,
       sqlc.arg('required')::boolean,
       COALESCE((SELECT max(f.position) FROM task_fields f
                 WHERE f.type_id = t.id AND f.deleted_at IS NULL), 0) + 1
FROM task_types t
WHERE t.id = sqlc.arg('type_id') AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
RETURNING *;

-- name: ListTaskFields :many
-- Every field of the company's types, each type's in its order, without the
-- deleted ones (a deleted type's fields are deleted with it).
SELECT * FROM task_fields
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY type_id, position, id;

-- name: GetTaskField :one
-- A field of the company's type; pgx.ErrNoRows when the type has none such,
-- or it is deleted.
SELECT * FROM task_fields
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL;

-- name: UpdateTaskField :one
-- Changes a field's name and required mark; a NULL argument leaves its
-- column as it is. The kind and the dropdown are never changed.
-- pgx.ErrNoRows when the type has no such field, or it is deleted.
UPDATE task_fields
SET label = COALESCE(sqlc.narg('label'), label),
    required = COALESCE(sqlc.narg('required'), required)
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL
RETURNING *;

-- name: DeleteTaskField :one
-- Hides a field of the company's type. pgx.ErrNoRows when the type has no
-- such field, or it is deleted already.
UPDATE task_fields SET deleted_at = now()
WHERE id = sqlc.arg('id') AND type_id = sqlc.arg('type_id') AND company_id = sqlc.arg('company_id')
  AND deleted_at IS NULL
RETURNING id;

-- name: DeleteTaskTypeFields :exec
-- Hides every field of a type: they go with it when it is deleted.
UPDATE task_fields SET deleted_at = now()
WHERE type_id = $1 AND deleted_at IS NULL;

-- name: OrderTaskFields :exec
-- Puts the type's fields in the order of ids: the first gets position 1. An
-- id that is not a live field of the type is passed over.
UPDATE task_fields f SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE f.id = n.id AND f.type_id = sqlc.arg('type_id') AND f.deleted_at IS NULL;

-- name: SeedTaskSettings :exec
-- Gives a new company the ready stages (Yangi, Jarayonda, Bajarildi) and the
-- ready type (Vazifa). The companies that were there before got them from
-- migration 00007.
WITH stages AS (
    INSERT INTO task_stages (company_id, name, color, is_done, position)
    VALUES (sqlc.arg('company_id'), 'Yangi', 'blue', false, 1),
           (sqlc.arg('company_id'), 'Jarayonda', 'amber', false, 2),
           (sqlc.arg('company_id'), 'Bajarildi', 'green', true, 3)
)
INSERT INTO task_types (company_id, name, position)
VALUES (sqlc.arg('company_id'), 'Vazifa', 1);
