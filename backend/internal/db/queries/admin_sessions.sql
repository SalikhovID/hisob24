-- name: CreateAdminSession :one
INSERT INTO admin_sessions (admin_id, source, expires_at)
VALUES ($1, $2, $3)
RETURNING *;
