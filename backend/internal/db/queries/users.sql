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

-- name: ListCompanyUsers :many
SELECT u.phone, u.full_name, uc.role, uc.created_at
FROM user_companies uc
JOIN users u ON u.phone = uc.user_phone
WHERE uc.company_id = $1
ORDER BY uc.created_at, u.phone;

-- name: ListUserCompanies :many
-- The user's companies for /app/me and for choosing one at login.
SELECT c.id, c.name, c.end_date, c.is_active, uc.role
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1
ORDER BY c.name, c.id;
