-- name: CreateRole :one
-- A company role: the permissions are "section.action" keys, checked by
-- internal/access before they get here.
INSERT INTO roles (company_id, name, permissions)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.arg('permissions')::text[])
RETURNING *;

-- name: ListRoles :many
-- The company's roles by name (whatever the case), each with how many
-- members hold it.
SELECT r.*, (SELECT count(*) FROM user_companies uc WHERE uc.role_id = r.id)::bigint AS members_count
FROM roles r
WHERE r.company_id = $1
ORDER BY lower(r.name), r.id;

-- name: GetRole :one
-- The company's role with how many members hold it; pgx.ErrNoRows when the
-- company has none such.
SELECT r.*, (SELECT count(*) FROM user_companies uc WHERE uc.role_id = r.id)::bigint AS members_count
FROM roles r
WHERE r.id = $1 AND r.company_id = $2;

-- name: UpdateRole :one
-- Replaces a role's name and permissions. pgx.ErrNoRows when the company
-- has no such role.
UPDATE roles
SET name = sqlc.arg('name'), permissions = sqlc.arg('permissions')::text[], updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id')
RETURNING *;

-- name: DeleteRole :one
-- Removes the company's role for good. A role someone holds is refused by
-- the foreign key (23503); pgx.ErrNoRows when the company has none such.
DELETE FROM roles WHERE id = $1 AND company_id = $2 RETURNING id;

-- name: CountRoleMembers :one
-- How many members hold the role: one that is held is not deleted.
SELECT count(*) FROM user_companies WHERE role_id = $1;
