-- name: GetActiveAdmin :one
SELECT * FROM admins
WHERE telegram_id = $1 AND is_active;
