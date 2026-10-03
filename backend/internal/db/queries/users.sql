-- name: UpsertUser :exec
-- A phone that is already a user keeps its row and name.
INSERT INTO users (phone, full_name)
VALUES ($1, $2)
ON CONFLICT (phone) DO NOTHING;

-- name: GetUser :one
SELECT * FROM users WHERE phone = $1;

-- name: UserExists :one
SELECT EXISTS (SELECT 1 FROM users WHERE phone = $1);

-- name: ListCompanyUsers :many
-- The company's members under the names they go by there: the owner first,
-- then the users in the order they joined.
SELECT user_phone AS phone, full_name, role, created_at
FROM user_companies
WHERE company_id = $1
ORDER BY (role = 'owner') DESC, created_at, user_phone;

-- name: ListUserCompanies :many
-- The user's companies for /app/me and for choosing one at login, each with
-- the role and the name the user goes by there. days_left counts from the
-- database's today, as the 402 check does.
SELECT c.id, c.name, c.end_date, (c.end_date - CURRENT_DATE)::int AS days_left, c.is_active, uc.role, uc.full_name
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

-- name: SetCompanyOwner :one
-- Makes the user the company's owner under full_name, a member or not. The
-- owner before has to be demoted first: a company has one owner.
INSERT INTO user_companies (user_phone, company_id, role, full_name)
VALUES ($1, $2, 'owner', $3)
ON CONFLICT (user_phone, company_id) DO UPDATE SET role = 'owner', full_name = EXCLUDED.full_name
RETURNING *;

-- name: DemoteCompanyOwner :exec
-- The company's owner stays in it as a user: the step before another owner
-- is set.
UPDATE user_companies SET role = 'user' WHERE company_id = $1 AND role = 'owner';

-- name: HasCompany :one
-- Whether the phone is a member of at least one company: only such a user
-- may sign in.
SELECT EXISTS (SELECT 1 FROM user_companies WHERE user_phone = $1);
