-- name: GetLocation :one
-- The company's location; pgx.ErrNoRows when the company has no such
-- location, or deleted it.
SELECT * FROM locations WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: SeedLocation :one
-- Gives a new company the ready location ("Asosiy"). The companies that
-- were there before got theirs from migration 00010.
INSERT INTO locations (company_id, name) VALUES ($1, 'Asosiy') RETURNING *;

-- name: ListMemberLocations :many
-- The locations a member may work in (logic/locations.md, section 5): every
-- live one of the company's for the owner and for a member without a
-- restriction, the live ones among the restriction's otherwise; in the
-- order they were added. Nothing for someone who is not a member.
SELECT l.id, l.name
FROM locations l
JOIN user_companies uc ON uc.company_id = l.company_id AND uc.user_phone = sqlc.arg('user_phone')
WHERE l.company_id = sqlc.arg('company_id') AND l.deleted_at IS NULL
  AND (uc.all_locations OR EXISTS (SELECT 1 FROM member_locations ml
       WHERE ml.user_phone = uc.user_phone AND ml.company_id = uc.company_id AND ml.location_id = l.id))
ORDER BY l.id;

-- name: ListCompanyMemberLocations :many
-- The restrictions of the company's members: each restricted member's live
-- locations, by member and in the order the locations were added. A member
-- without a restriction has no rows.
SELECT ml.user_phone, l.id, l.name
FROM member_locations ml
JOIN locations l ON l.id = ml.location_id AND l.deleted_at IS NULL
WHERE ml.company_id = $1
ORDER BY ml.user_phone, l.id;

-- name: DeleteMemberLocations :exec
-- Drops a member's restriction: the locations it named. The member works in
-- every location once all_locations is raised with it.
DELETE FROM member_locations WHERE user_phone = $1 AND company_id = $2;

-- name: ListLocations :many
-- The company's live locations for the admin, in the order they were
-- added, each with how many tasks stand in it (the deleted not counted).
SELECT l.id, l.name, l.created_at,
       (SELECT count(*) FROM tasks t WHERE t.location_id = l.id AND t.deleted_at IS NULL) AS tasks_count
FROM locations l
WHERE l.company_id = $1 AND l.deleted_at IS NULL
ORDER BY l.id;

-- name: CreateLocation :one
-- Adds a location to the company. The name is one location's in a company
-- (23505, whatever the case, among the live ones).
INSERT INTO locations (company_id, name) VALUES ($1, $2) RETURNING *;

-- name: RenameLocation :one
-- Renames the company's location; pgx.ErrNoRows when the company has no
-- such location, or deleted it.
UPDATE locations SET name = sqlc.arg('name')
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteLocation :one
-- Hides the location: nothing is removed, and its name is free again.
-- pgx.ErrNoRows when the company has no such location, or deleted it
-- already.
UPDATE locations SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: CountLocations :one
-- How many live locations the company has: the last one is not deleted.
SELECT count(*) FROM locations WHERE company_id = $1 AND deleted_at IS NULL;

-- name: CountLocationTasks :one
-- How many tasks stand in the location: one in use is not deleted. Deleted
-- tasks do not count.
SELECT count(*) FROM tasks WHERE location_id = $1 AND deleted_at IS NULL;

-- name: MemberInLocation :one
-- Whether the member may work in the location (logic/locations.md, section
-- 5): the owner and a member without a restriction in every one of the
-- company's, a restricted member in the restriction's. False for someone
-- who is not a member, and for another company's location.
SELECT EXISTS (
    SELECT 1 FROM user_companies uc
    JOIN locations l ON l.company_id = uc.company_id AND l.id = sqlc.arg('location_id')
    WHERE uc.user_phone = sqlc.arg('user_phone') AND uc.company_id = sqlc.arg('company_id')
      AND (uc.all_locations OR EXISTS (SELECT 1 FROM member_locations ml
           WHERE ml.user_phone = uc.user_phone AND ml.company_id = uc.company_id AND ml.location_id = l.id)));
