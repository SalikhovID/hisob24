-- name: UpsertUser :exec
-- A phone that is already a user keeps its row and name.
INSERT INTO users (phone, full_name)
VALUES ($1, $2)
ON CONFLICT (phone) DO NOTHING;

-- name: GetUser :one
SELECT * FROM users WHERE phone = $1;

-- name: ListCompanyUsers :many
-- The company's members under the names they go by there, each with the
-- role they hold (none for the owner and for a user without one): the owner
-- first, then the users in the order they joined.
SELECT uc.user_phone AS phone, uc.full_name, uc.role, uc.role_id, r.name AS role_name, uc.created_at
FROM user_companies uc
LEFT JOIN roles r ON r.id = uc.role_id
WHERE uc.company_id = $1
ORDER BY (uc.role = 'owner') DESC, uc.created_at, uc.user_phone;

-- name: GetCompanyMember :one
-- One member of the company under the name they go by there, with the role
-- they hold; pgx.ErrNoRows when the user is not its member.
SELECT uc.user_phone AS phone, uc.full_name, uc.role, uc.role_id, r.name AS role_name, uc.created_at
FROM user_companies uc
LEFT JOIN roles r ON r.id = uc.role_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;

-- name: ListUserCompanies :many
-- The user's companies for /app/me and for choosing one at login, each with
-- the role, the company role they hold (if any) and the name the user goes
-- by there. days_left counts from the database's today, as the 402 check
-- does.
SELECT c.id, c.name, c.end_date, (c.end_date - CURRENT_DATE)::int AS days_left, c.is_active, uc.role, uc.full_name, r.name AS role_name
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
LEFT JOIN roles r ON r.id = uc.role_id
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
-- owner before has to be demoted first: a company has one owner. A role the
-- user held as a member is taken away: the owner has every permission.
INSERT INTO user_companies (user_phone, company_id, role, full_name)
VALUES ($1, $2, 'owner', $3)
ON CONFLICT (user_phone, company_id) DO UPDATE SET role = 'owner', role_id = NULL, full_name = EXCLUDED.full_name
RETURNING *;

-- name: DemoteCompanyOwner :exec
-- The company's owner stays in it as a user: the step before another owner
-- is set.
UPDATE user_companies SET role = 'user' WHERE company_id = $1 AND role = 'owner';

-- name: HasCompany :one
-- Whether the phone is a member of at least one company: only such a user
-- may sign in.
SELECT EXISTS (SELECT 1 FROM user_companies WHERE user_phone = $1);

-- name: GetCompanyAccess :one
-- A user's standing in a company, read on every request: the role there,
-- the company role they hold with its permissions (NULL for the owner and
-- for a user without one) and whether the subscription lets the company be
-- used (the end date has not passed and it is not blocked). pgx.ErrNoRows
-- when the user is not its member.
SELECT uc.role, uc.role_id, r.permissions, (c.end_date >= CURRENT_DATE AND c.is_active)::boolean AS active
FROM user_companies uc
JOIN companies c ON c.id = uc.company_id
LEFT JOIN roles r ON r.id = uc.role_id
WHERE uc.user_phone = $1 AND uc.company_id = $2;

-- name: RenameCompanyUser :one
-- Changes the name a user goes by in the company. No row (pgx.ErrNoRows) for
-- the owner, whom the app never touches, and for someone who is not a member.
UPDATE user_companies SET full_name = $3
WHERE user_phone = $1 AND company_id = $2 AND role = 'user'
RETURNING *;

-- name: RemoveCompanyUser :one
-- Takes a user out of the company; the user and their other companies stay.
-- No row (pgx.ErrNoRows) for the owner, whom the app never touches, and for
-- someone who is not a member.
DELETE FROM user_companies
WHERE user_phone = $1 AND company_id = $2 AND role = 'user'
RETURNING user_phone;

-- name: GetMemberName :one
-- The name a user goes by in a company, NULL when they go by none there:
-- what is kept beside what they do to its customers. pgx.ErrNoRows when the
-- user is not its member.
SELECT full_name FROM user_companies
WHERE user_phone = $1 AND company_id = $2;

-- name: SetCompanyUserRole :one
-- Gives a user of the company a role, or takes it away (NULL). The role
-- has to be the company's own (the foreign key refuses another's, 23503).
-- No row (pgx.ErrNoRows) for the owner, who holds no role, and for someone
-- who is not a member.
UPDATE user_companies SET role_id = sqlc.narg('role_id')
WHERE user_phone = sqlc.arg('user_phone') AND company_id = sqlc.arg('company_id') AND role = 'user'
RETURNING *;
