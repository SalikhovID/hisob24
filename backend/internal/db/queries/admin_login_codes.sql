-- name: CreateAdminLoginCode :one
-- A unique violation (23505) means the hash of another unused code: the
-- caller draws a new code.
INSERT INTO admin_login_codes (admin_id, code_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;

-- name: ConsumeAdminLoginCode :one
-- Spends a live code in one statement, so a code opens one session only.
UPDATE admin_login_codes
SET used_at = now()
WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
RETURNING admin_id;

-- name: DeleteStaleAdminLoginCodes :exec
-- Before a new code: this admin's unused codes and everyone's expired ones.
DELETE FROM admin_login_codes
WHERE (admin_id = $1 AND used_at IS NULL) OR expires_at <= now();

-- name: DeleteAdminLoginCode :exec
-- Drops a code the bot could not deliver.
DELETE FROM admin_login_codes WHERE id = $1;
