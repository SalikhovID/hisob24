-- name: UpsertUser :exec
-- A phone that is already a user keeps its row and name.
INSERT INTO users (phone, full_name)
VALUES ($1, $2)
ON CONFLICT (phone) DO NOTHING;

-- name: GetUser :one
SELECT * FROM users WHERE phone = $1;

-- name: UserExists :one
SELECT EXISTS (SELECT 1 FROM users WHERE phone = $1);

-- name: UpsertCompanyUser :one
-- Adds the user to the company; a member already there gets the new role.
INSERT INTO user_companies (user_phone, company_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (user_phone, company_id) DO UPDATE SET role = EXCLUDED.role
RETURNING *;
