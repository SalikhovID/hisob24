-- name: CreateAdminLoginCode :one
-- A unique violation (23505) means the hash of another unused code: the
-- caller draws a new code.
INSERT INTO admin_login_codes (admin_id, code_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;
