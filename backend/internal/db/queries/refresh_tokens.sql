-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_phone, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;
