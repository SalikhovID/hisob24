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
-- The user's companies for /app/me and for choosing one at login. days_left
-- counts from the database's today, as the 402 check does.
SELECT c.id, c.name, c.end_date, (c.end_date - CURRENT_DATE)::int AS days_left, c.is_active, uc.role
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1
ORDER BY c.name, c.id;

-- name: GetUserCompany :one
-- The membership behind switch-company; pgx.ErrNoRows when not a member.
SELECT c.id, c.name, c.end_date, c.is_active, uc.role
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;

-- name: AddCompanyUser :one
-- Adds a member with a role and the name they go by in the company. No row
-- (pgx.ErrNoRows) when the user is a member already: nothing changes.
INSERT INTO user_companies (user_phone, company_id, role, full_name)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_phone, company_id) DO NOTHING
RETURNING *;
