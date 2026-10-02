-- name: GetActiveAdmin :one
SELECT * FROM admins
WHERE telegram_id = $1 AND is_active;

-- name: ListAdmins :many
SELECT * FROM admins
ORDER BY created_at, telegram_id;

-- name: CreateOrReactivateAdmin :one
-- Adds an admin or reactivates a deactivated one. An admin who is already
-- active is left as is and no row comes back (pgx.ErrNoRows -> 409).
INSERT INTO admins (telegram_id, full_name)
VALUES ($1, $2)
ON CONFLICT (telegram_id) DO UPDATE
SET is_active = true, full_name = EXCLUDED.full_name
WHERE NOT admins.is_active
RETURNING *;

-- name: LockActiveAdmins :many
-- Locks every active admin row, so "keep at least one active admin" holds
-- under concurrent deactivations.
SELECT telegram_id FROM admins
WHERE is_active
ORDER BY telegram_id
FOR UPDATE;
