-- +goose Up
-- The permissions on the orders are named after them (internal/access):
-- every role's tasks.* is orders.*, in its place, so a role allows what it
-- allowed.
UPDATE roles SET permissions = ARRAY(
    SELECT regexp_replace(p, '^tasks\.', 'orders.')
    FROM unnest(permissions) WITH ORDINALITY AS u(p, n) ORDER BY n)
WHERE EXISTS (SELECT 1 FROM unnest(permissions) AS u(p) WHERE p LIKE 'tasks.%');

-- +goose Down
UPDATE roles SET permissions = ARRAY(
    SELECT regexp_replace(p, '^orders\.', 'tasks.')
    FROM unnest(permissions) WITH ORDINALITY AS u(p, n) ORDER BY n)
WHERE EXISTS (SELECT 1 FROM unnest(permissions) AS u(p) WHERE p LIKE 'orders.%');
