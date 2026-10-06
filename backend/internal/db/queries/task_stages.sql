-- name: CreateTaskStage :one
-- A new stage goes last among the company's.
INSERT INTO task_stages (company_id, name, color, is_done, position)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.arg('color'), sqlc.arg('is_done'),
        COALESCE((SELECT max(s.position) FROM task_stages s
                  WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL), 0) + 1)
RETURNING *;

-- name: ListTaskStages :many
-- The company's stages in their order, without the deleted.
SELECT * FROM task_stages
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY position, id;

-- name: GetTaskStage :one
-- The company's stage; pgx.ErrNoRows when it has none such, or deleted it.
SELECT * FROM task_stages
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: UpdateTaskStage :one
-- Changes a stage's name, color and done mark; a NULL argument leaves its
-- column as it is. pgx.ErrNoRows when the company has no such stage, or
-- deleted it.
UPDATE task_stages
SET name = COALESCE(sqlc.narg('name'), name),
    color = COALESCE(sqlc.narg('color'), color),
    is_done = COALESCE(sqlc.narg('is_done'), is_done)
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteTaskStage :one
-- Hides the stage: nothing is removed. pgx.ErrNoRows when the company has
-- no such stage, or deleted it already.
UPDATE task_stages SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: OrderTaskStages :exec
-- Puts the company's stages in the order of ids: the first gets position 1.
-- An id that is not a live stage of the company is passed over.
UPDATE task_stages t SET position = n.ord::int
FROM unnest(sqlc.arg('ids')::bigint[]) WITH ORDINALITY AS n(id, ord)
WHERE t.id = n.id AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL;
