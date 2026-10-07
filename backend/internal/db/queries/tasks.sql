-- name: CreateTask :one
-- Enters a task, in a location of the company. assignee_name and
-- created_by_name are the names the members go by in the company now: they
-- stay when the members leave the company.
INSERT INTO tasks (company_id, type_id, stage_id, customer_id, location_id, title, deadline, assignee_phone, assignee_name, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('type_id'), sqlc.arg('stage_id'), sqlc.arg('customer_id'), sqlc.arg('location_id'), sqlc.arg('title'), sqlc.arg('deadline'),
        sqlc.narg('assignee_phone'), sqlc.narg('assignee_name'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetTask :one
-- The company's task with its location, its customer's phone and name (the
-- customer's answer to its type's first text field); pgx.ErrNoRows when the
-- company has no such task, or deleted it. assignee_name and
-- created_by_name are the names the members go by in the company now; once
-- they have left it (or go by no name), the names of then.
SELECT t.id, t.type_id, t.stage_id, t.customer_id, t.location_id, t.title, t.deadline, t.assignee_phone,
       COALESCE(a.full_name, t.assignee_name) AS assignee_name,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name,
       t.created_at, t.updated_at,
       c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name
FROM tasks t
JOIN customers c ON c.id = t.customer_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
LEFT JOIN user_companies a ON a.user_phone = t.assignee_phone AND a.company_id = t.company_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListTasks :many
-- A page of the company's tasks, the one due soonest first (then the older
-- task), without the deleted. type_id, stage_id, assignee_phone and
-- customer_id each keep one; search, escaped for ILIKE, is looked for in the
-- title, in the task's text answers and in the customer's text answers;
-- digits, the digits of a search that is a number, in the customer's phone
-- and in the task's and the customer's whole number answers. A NULL argument
-- leaves its filter out.
SELECT t.id, t.type_id, t.stage_id, t.customer_id, t.location_id, t.title, t.deadline, t.assignee_phone,
       COALESCE(a.full_name, t.assignee_name) AS assignee_name,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name,
       t.created_at, t.updated_at,
       c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name
FROM tasks t
JOIN customers c ON c.id = t.customer_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
LEFT JOIN user_companies a ON a.user_phone = t.assignee_phone AND a.company_id = t.company_id
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('type_id')::bigint IS NULL OR t.type_id = sqlc.narg('type_id')::bigint)
  AND (sqlc.narg('stage_id')::bigint IS NULL OR t.stage_id = sqlc.narg('stage_id')::bigint)
  AND (sqlc.narg('assignee_phone')::text IS NULL OR t.assignee_phone = sqlc.narg('assignee_phone')::text)
  AND (sqlc.narg('customer_id')::bigint IS NULL OR t.customer_id = sqlc.narg('customer_id')::bigint)
  AND (sqlc.narg('search')::text IS NULL
       OR t.title ILIKE '%' || sqlc.narg('search')::text || '%'
       OR c.phone LIKE '%' || sqlc.narg('digits')::text || '%'
       OR EXISTS (SELECT 1 FROM task_values v
                  WHERE v.task_id = t.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%'))
       OR EXISTS (SELECT 1 FROM customer_values v
                  WHERE v.customer_id = c.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%')))
ORDER BY t.deadline, t.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountTasks :one
-- How many tasks ListTasks finds under the same filter, on all of its pages.
SELECT count(*) FROM tasks t
JOIN customers c ON c.id = t.customer_id
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('type_id')::bigint IS NULL OR t.type_id = sqlc.narg('type_id')::bigint)
  AND (sqlc.narg('stage_id')::bigint IS NULL OR t.stage_id = sqlc.narg('stage_id')::bigint)
  AND (sqlc.narg('assignee_phone')::text IS NULL OR t.assignee_phone = sqlc.narg('assignee_phone')::text)
  AND (sqlc.narg('customer_id')::bigint IS NULL OR t.customer_id = sqlc.narg('customer_id')::bigint)
  AND (sqlc.narg('search')::text IS NULL
       OR t.title ILIKE '%' || sqlc.narg('search')::text || '%'
       OR c.phone LIKE '%' || sqlc.narg('digits')::text || '%'
       OR EXISTS (SELECT 1 FROM task_values v
                  WHERE v.task_id = t.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%'))
       OR EXISTS (SELECT 1 FROM customer_values v
                  WHERE v.customer_id = c.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%')));

-- name: UpdateTask :one
-- An edit: the task's title, deadline, stage and assignee as they are now,
-- and the moment of the edit. pgx.ErrNoRows when the company has no such
-- task, or deleted it.
UPDATE tasks
SET title = sqlc.arg('title'), deadline = sqlc.arg('deadline'), stage_id = sqlc.arg('stage_id'),
    assignee_phone = sqlc.narg('assignee_phone'), assignee_name = sqlc.narg('assignee_name'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING updated_at;

-- name: MoveTask :one
-- Puts the task in another stage. pgx.ErrNoRows when the company has no such
-- task, or deleted it.
UPDATE tasks SET stage_id = sqlc.arg('stage_id'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING updated_at;

-- name: DeleteTask :one
-- Hides the task: nothing is removed. pgx.ErrNoRows when the company has no
-- such task, or deleted it already.
UPDATE tasks SET deleted_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING id;

-- name: AddTaskValue :exec
-- One row of a task's answers: a text, a whole number, or an option chosen.
INSERT INTO task_values (task_id, field_id, option_id, text_value, int_value)
VALUES (sqlc.arg('task_id'), sqlc.arg('field_id'), sqlc.narg('option_id'), sqlc.narg('text_value'), sqlc.narg('int_value'));

-- name: DeleteTaskValues :exec
-- Clears a task's answers: an edit writes them anew. What they were stays in
-- the task's history.
DELETE FROM task_values WHERE task_id = $1;

-- name: ListTaskValues :many
-- The answers of the tasks named: each task's in the order of its type's
-- fields, the options of one field in the order of their dropdown. kind
-- tells how a field's rows are read.
SELECT v.task_id, v.field_id, f.kind, v.option_id, v.text_value, v.int_value
FROM task_values v
JOIN task_fields f ON f.id = v.field_id
LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
WHERE v.task_id = ANY(sqlc.arg('task_ids')::bigint[])
ORDER BY v.task_id, f.position, f.id, o.position, o.id;

-- name: CountStageTasks :one
-- How many tasks stand in the stage: one in use is not deleted. Deleted
-- tasks do not count.
SELECT count(*) FROM tasks WHERE stage_id = $1 AND deleted_at IS NULL;

-- name: CountTypeTasks :one
-- How many tasks are of the type: one in use is not deleted.
SELECT count(*) FROM tasks WHERE type_id = $1 AND deleted_at IS NULL;

-- name: CountTaskFieldTasks :one
-- How many tasks filled the field in: one in use is not deleted.
SELECT count(DISTINCT v.task_id) FROM task_values v
JOIN tasks t ON t.id = v.task_id
WHERE v.field_id = $1 AND t.deleted_at IS NULL;

-- name: CountOptionTasks :one
-- How many tasks chose the option, in any field: one in use is not deleted.
SELECT count(DISTINCT v.task_id) FROM task_values v
JOIN tasks t ON t.id = v.task_id
WHERE v.option_id = $1 AND t.deleted_at IS NULL;

-- name: AddTaskHistory :exec
-- Writes down what a member did to a task: created, updated (a move too) or
-- deleted. changes is what an edit changed, each thing as text under the
-- names of that time; actor_name is the name the member goes by in the
-- company now.
INSERT INTO task_history (task_id, action, actor_phone, actor_name, changes)
VALUES (sqlc.arg('task_id'), sqlc.arg('action'), sqlc.arg('actor_phone'), sqlc.narg('actor_name'), sqlc.arg('changes'));

-- name: ListTaskHistory :many
-- What happened to the task, the latest first. actor_name is the name the
-- member who did it goes by in the company now; once they have left it (or
-- go by no name), the name of then.
SELECT h.id, h.action, COALESCE(m.full_name, h.actor_name) AS actor_name, h.changes, h.created_at
FROM task_history h
JOIN tasks t ON t.id = h.task_id
LEFT JOIN user_companies m ON m.user_phone = h.actor_phone AND m.company_id = t.company_id
WHERE h.task_id = $1
ORDER BY h.id DESC;
