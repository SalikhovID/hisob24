-- name: UpsertUser :exec
-- A phone that is already a user keeps its row and name.
INSERT INTO users (phone, full_name)
VALUES ($1, $2)
ON CONFLICT (phone) DO NOTHING;

-- name: GetUser :one
SELECT * FROM users WHERE phone = $1;
