-- name: CreateCompany :one
INSERT INTO companies (name, end_date, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetCompany :one
SELECT * FROM companies WHERE id = $1;

-- name: ListCompanies :many
-- status: "active" = end_date not passed and not blocked, "expired" = past
-- end_date or blocked, NULL = everything. search matches the name in any case.
SELECT * FROM companies
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('status')::text IS NULL
       OR (sqlc.narg('status')::text = 'active' AND end_date >= CURRENT_DATE AND is_active)
       OR (sqlc.narg('status')::text = 'expired' AND (end_date < CURRENT_DATE OR NOT is_active)))
ORDER BY id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountCompanies :one
-- The same filter as ListCompanies, for the page count.
SELECT count(*) FROM companies
WHERE (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%')
  AND (sqlc.narg('status')::text IS NULL
       OR (sqlc.narg('status')::text = 'active' AND end_date >= CURRENT_DATE AND is_active)
       OR (sqlc.narg('status')::text = 'expired' AND (end_date < CURRENT_DATE OR NOT is_active)));

-- name: UpdateCompany :one
-- PATCH: a NULL argument leaves its column as it is.
UPDATE companies
SET name = COALESCE(sqlc.narg('name'), name),
    is_active = COALESCE(sqlc.narg('is_active'), is_active)
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: LockCompanyEndDate :one
-- Locks the company for a billing transaction. today is the database's
-- CURRENT_DATE, so the new end_date follows the same clock as the checks.
SELECT end_date, CURRENT_DATE::date AS today
FROM companies
WHERE id = $1
FOR UPDATE;

-- name: SetCompanyEndDate :exec
UPDATE companies SET end_date = $2 WHERE id = $1;

-- name: LockCompany :one
-- Locks the company for a change of its owner, so two changes take turns;
-- pgx.ErrNoRows when there is no such company.
SELECT id FROM companies WHERE id = $1 FOR UPDATE;
