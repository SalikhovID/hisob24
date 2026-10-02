-- name: CreateAdminSession :one
INSERT INTO admin_sessions (admin_id, source, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetAdminBySession :one
-- The admin behind a live session; an expired session or a deactivated
-- admin gives pgx.ErrNoRows.
SELECT a.*
FROM admin_sessions s
JOIN admins a ON a.telegram_id = s.admin_id
WHERE s.id = $1 AND s.expires_at > now() AND a.is_active;

-- name: DeleteAdminSession :exec
-- Logout.
DELETE FROM admin_sessions WHERE id = $1;
