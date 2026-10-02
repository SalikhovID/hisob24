-- name: GetActiveAdmin :one
SELECT * FROM admins
WHERE telegram_id = $1 AND is_active;

-- name: ListAdmins :many
SELECT * FROM admins
ORDER BY created_at, telegram_id;
