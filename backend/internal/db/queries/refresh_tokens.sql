-- name: CreateRefreshToken :one
-- company_id is the company the access tokens it refreshes are for.
INSERT INTO refresh_tokens (user_phone, token_hash, expires_at, company_id)
VALUES ($1, $2, $3, $4)
RETURNING id;

-- name: RevokeRefreshToken :one
-- Revokes a live token and returns its owner and company: the first step of
-- rotation and of logout. A revoked, expired or unknown token gives
-- pgx.ErrNoRows.
UPDATE refresh_tokens
SET revoked_at = now()
WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
RETURNING user_phone, company_id;
