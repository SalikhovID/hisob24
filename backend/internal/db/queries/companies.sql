-- name: CreateCompany :one
INSERT INTO companies (name, end_date, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetCompany :one
SELECT * FROM companies WHERE id = $1;
