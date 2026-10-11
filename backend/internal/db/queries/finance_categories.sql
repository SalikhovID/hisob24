-- name: CreateFinanceCategory :one
-- A new category goes last among the company's of the kind; 23505 when
-- the name is another live category's of the kind (whatever the case).
INSERT INTO finance_categories (company_id, name, kind, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.arg('kind'),
        COALESCE((SELECT max(c.position) FROM finance_categories c
                  WHERE c.company_id = sqlc.arg('company_id') AND c.kind = sqlc.arg('kind') AND c.deleted_at IS NULL), 0) + 1)
RETURNING *;

-- name: ListFinanceCategories :many
-- The company's live categories of the kind (every kind with NULL, the
-- expenses first), each kind in its order.
SELECT * FROM finance_categories
WHERE company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND (sqlc.narg('kind')::text IS NULL OR kind = sqlc.narg('kind')::text)
ORDER BY kind, position, id;

-- name: GetFinanceCategory :one
-- The company's live category; pgx.ErrNoRows when it has none such, or
-- deleted it.
SELECT * FROM finance_categories WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: UpdateFinanceCategory :one
-- Changes the name and the active flag; a NULL argument leaves its column
-- as it is. The kind never changes. pgx.ErrNoRows when the company has no
-- such category, or deleted it; 23505 when the name is another's.
UPDATE finance_categories
SET name = COALESCE(sqlc.narg('name'), name),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteFinanceCategory :one
-- Hides the category: nothing is removed, its name is free again.
-- pgx.ErrNoRows when the company has no such category, or deleted it already.
UPDATE finance_categories SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: OrderFinanceCategories :exec
-- Puts the company's categories of the kind in the order of ids: the first
-- gets position 1. An id that is not a live category of the kind is passed
-- over.
UPDATE finance_categories c SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE c.id = n.id AND c.company_id = sqlc.arg('company_id') AND c.kind = sqlc.arg('kind') AND c.deleted_at IS NULL;
