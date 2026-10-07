-- name: GetLocation :one
-- The company's location; pgx.ErrNoRows when the company has no such
-- location, or deleted it.
SELECT * FROM locations WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
