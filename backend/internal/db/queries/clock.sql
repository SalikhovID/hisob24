-- name: CurrentDate :one
-- The database's today: every end_date check counts from it.
SELECT CURRENT_DATE::date AS today;
