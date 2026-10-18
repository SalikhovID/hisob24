-- name: CreateOrder :one
-- Enters an order, in a location of the company. assignee_name and
-- created_by_name are the names the members go by in the company now: they
-- stay when the members leave the company.
INSERT INTO orders (company_id, type_id, stage_id, customer_id, location_id, title, deadline, assignee_phone, assignee_name, created_by, created_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('type_id'), sqlc.arg('stage_id'), sqlc.arg('customer_id'), sqlc.arg('location_id'), sqlc.arg('title'), sqlc.arg('deadline'),
        sqlc.narg('assignee_phone'), sqlc.narg('assignee_name'), sqlc.arg('created_by'), sqlc.narg('created_by_name'))
RETURNING *;

-- name: GetOrder :one
-- The company's order with its location, its customer's phone and name (the
-- customer's answer to its type's first text field) and its money
-- (logic/orders.md, 4.3): from its live document, the price (amount) in
-- its currency by its rate and in so'm, what was paid for it (the live
-- payments linked to the document, each turned into the order's currency
-- by its own rate row) and the document (document_id); without a document
-- nothing, in so'm. pgx.ErrNoRows when the company has no such order, or
-- deleted it. assignee_name and created_by_name are the names the members
-- go by in the company now; once they have left it (or go by no name), the
-- names of then.
SELECT t.id, t.type_id, t.stage_id, t.customer_id, t.location_id, t.title, t.deadline, t.assignee_phone,
       COALESCE(a.full_name, t.assignee_name) AS assignee_name,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name,
       t.created_at, t.updated_at,
       c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       COALESCE(od.total, 0)::numeric(14,2) AS amount,
       COALESCE(od.currency_id, 1)::bigint AS currency_id,
       COALESCE((CASE od.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END), 1)::numeric(14,4) AS rate,
       COALESCE(convert_amount(od.total, od.currency_id, 1, cr), 0)::numeric(14,2) AS amount_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, od.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = od.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       COALESCE(od.id, 0)::bigint AS document_id
FROM orders t
JOIN customers c ON c.id = t.customer_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
LEFT JOIN user_companies a ON a.user_phone = t.assignee_phone AND a.company_id = t.company_id
LEFT JOIN transactions od ON od.order_id = t.id AND od.kind = 'order' AND od.deleted_at IS NULL
LEFT JOIN currency_rates cr ON cr.id = od.currency_rate_id
WHERE t.id = sqlc.arg('id') AND t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: ListOrders :many
-- A page of the company's orders, the one due soonest first (then the older
-- order), without the deleted. type_id, stage_id, assignee_phone and
-- customer_id each keep one; search, escaped for ILIKE, is looked for in the
-- title, in the order's text answers and in the customer's text answers;
-- digits, the digits of a search that is a number, in the customer's phone
-- and in the order's and the customer's whole number answers. A NULL argument
-- leaves its filter out.
SELECT t.id, t.type_id, t.stage_id, t.customer_id, t.location_id, t.title, t.deadline, t.assignee_phone,
       COALESCE(a.full_name, t.assignee_name) AS assignee_name,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name,
       t.created_at, t.updated_at,
       c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       COALESCE(od.total, 0)::numeric(14,2) AS amount,
       COALESCE(od.currency_id, 1)::bigint AS currency_id,
       COALESCE((CASE od.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END), 1)::numeric(14,4) AS rate,
       COALESCE(convert_amount(od.total, od.currency_id, 1, cr), 0)::numeric(14,2) AS amount_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, od.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = od.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       COALESCE(od.id, 0)::bigint AS document_id
FROM orders t
JOIN customers c ON c.id = t.customer_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
LEFT JOIN user_companies a ON a.user_phone = t.assignee_phone AND a.company_id = t.company_id
LEFT JOIN transactions od ON od.order_id = t.id AND od.kind = 'order' AND od.deleted_at IS NULL
LEFT JOIN currency_rates cr ON cr.id = od.currency_rate_id
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
  AND (sqlc.narg('type_id')::bigint IS NULL OR t.type_id = sqlc.narg('type_id')::bigint)
  AND (sqlc.narg('stage_id')::bigint IS NULL OR t.stage_id = sqlc.narg('stage_id')::bigint)
  AND (sqlc.narg('assignee_phone')::text IS NULL OR t.assignee_phone = sqlc.narg('assignee_phone')::text)
  AND (sqlc.narg('customer_id')::bigint IS NULL OR t.customer_id = sqlc.narg('customer_id')::bigint)
  AND (sqlc.narg('search')::text IS NULL
       OR t.title ILIKE '%' || sqlc.narg('search')::text || '%'
       OR c.phone LIKE '%' || sqlc.narg('digits')::text || '%'
       OR EXISTS (SELECT 1 FROM order_values v
                  WHERE v.order_id = t.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%'))
       OR EXISTS (SELECT 1 FROM customer_values v
                  WHERE v.customer_id = c.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%')))
ORDER BY t.deadline, t.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: ListActiveOrders :many
-- The company's orders in the locations given whose stage is not a done
-- one, the one due soonest first (then the older order), as many as limit:
-- the home's nearest deadlines. The columns are ListOrders'.
SELECT t.id, t.type_id, t.stage_id, t.customer_id, t.location_id, t.title, t.deadline, t.assignee_phone,
       COALESCE(a.full_name, t.assignee_name) AS assignee_name,
       COALESCE(m.full_name, t.created_by_name) AS created_by_name,
       t.created_at, t.updated_at,
       c.phone AS customer_phone,
       (SELECT v.text_value FROM customer_fields f
          LEFT JOIN customer_values v ON v.field_id = f.id AND v.customer_id = c.id
        WHERE f.type_id = c.type_id AND f.kind = 'string' AND f.deleted_at IS NULL
        ORDER BY f.position, f.id LIMIT 1) AS customer_name,
       COALESCE(od.total, 0)::numeric(14,2) AS amount,
       COALESCE(od.currency_id, 1)::bigint AS currency_id,
       COALESCE((CASE od.currency_id WHEN 1 THEN cr.uzs WHEN 2 THEN cr.usd WHEN 3 THEN cr.eur WHEN 4 THEN cr.rub END), 1)::numeric(14,4) AS rate,
       COALESCE(convert_amount(od.total, od.currency_id, 1, cr), 0)::numeric(14,2) AS amount_uzs,
       COALESCE((SELECT sum(convert_amount(p.total, p.currency_id, od.currency_id, pr)) FROM transactions p JOIN currency_rates pr ON pr.id = p.currency_rate_id
                 WHERE p.linked_id = od.id AND p.deleted_at IS NULL), 0)::numeric(14,2) AS paid,
       COALESCE(od.id, 0)::bigint AS document_id
FROM orders t
JOIN order_stages s ON s.id = t.stage_id
JOIN customers c ON c.id = t.customer_id
LEFT JOIN user_companies m ON m.user_phone = t.created_by AND m.company_id = t.company_id
LEFT JOIN user_companies a ON a.user_phone = t.assignee_phone AND a.company_id = t.company_id
LEFT JOIN transactions od ON od.order_id = t.id AND od.kind = 'order' AND od.deleted_at IS NULL
LEFT JOIN currency_rates cr ON cr.id = od.currency_rate_id
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL AND NOT s.is_done
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
ORDER BY t.deadline, t.id
LIMIT sqlc.arg('limit');

-- name: CountOrders :one
-- How many orders ListOrders finds under the same filter, on all of its pages.
SELECT count(*) FROM orders t
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
       OR EXISTS (SELECT 1 FROM order_values v
                  WHERE v.order_id = t.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%'))
       OR EXISTS (SELECT 1 FROM customer_values v
                  WHERE v.customer_id = c.id AND v.option_id IS NULL
                    AND (v.text_value ILIKE '%' || sqlc.narg('search')::text || '%'
                         OR v.int_value::text LIKE '%' || sqlc.narg('digits')::text || '%')));

-- name: UpdateOrder :one
-- An edit: the order's title, deadline, stage and assignee as they are now,
-- and the moment of the edit. pgx.ErrNoRows when the company has no such
-- order, or deleted it.
UPDATE orders
SET title = sqlc.arg('title'), deadline = sqlc.arg('deadline'), stage_id = sqlc.arg('stage_id'),
    assignee_phone = sqlc.narg('assignee_phone'), assignee_name = sqlc.narg('assignee_name'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING updated_at;

-- name: MoveOrder :one
-- Puts the order in another stage. pgx.ErrNoRows when the company has no such
-- order, or deleted it.
UPDATE orders SET stage_id = sqlc.arg('stage_id'), updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING updated_at;

-- name: DeleteOrder :one
-- Hides the order: nothing is removed. pgx.ErrNoRows when the company has no
-- such order, or deleted it already.
UPDATE orders SET deleted_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
  AND location_id = ANY(sqlc.arg('location_ids')::bigint[])
RETURNING id;

-- name: AddOrderValue :exec
-- One row of an order's answers: a text, a whole number, or an option chosen.
INSERT INTO order_values (order_id, field_id, option_id, text_value, int_value)
VALUES (sqlc.arg('order_id'), sqlc.arg('field_id'), sqlc.narg('option_id'), sqlc.narg('text_value'), sqlc.narg('int_value'));

-- name: DeleteOrderValues :exec
-- Clears an order's answers: an edit writes them anew. What they were stays in
-- the order's history.
DELETE FROM order_values WHERE order_id = $1;

-- name: ListOrderValues :many
-- The answers of the orders named: each order's in the order of its type's
-- fields, the options of one field in the order of their dropdown. kind
-- tells how a field's rows are read.
SELECT v.order_id, v.field_id, f.kind, v.option_id, v.text_value, v.int_value
FROM order_values v
JOIN order_fields f ON f.id = v.field_id
LEFT JOIN customer_dropdown_options o ON o.id = v.option_id
WHERE v.order_id = ANY(sqlc.arg('order_ids')::bigint[])
ORDER BY v.order_id, f.position, f.id, o.position, o.id;

-- name: CountStageOrders :one
-- How many orders stand in the stage: one in use is not deleted. Deleted
-- orders do not count.
SELECT count(*) FROM orders WHERE stage_id = $1 AND deleted_at IS NULL;

-- name: CountTypeOrders :one
-- How many orders are of the type: one in use is not deleted.
SELECT count(*) FROM orders WHERE type_id = $1 AND deleted_at IS NULL;

-- name: CountOrderFieldOrders :one
-- How many orders filled the field in: one in use is not deleted.
SELECT count(DISTINCT v.order_id) FROM order_values v
JOIN orders t ON t.id = v.order_id
WHERE v.field_id = $1 AND t.deleted_at IS NULL;

-- name: CountOptionOrders :one
-- How many orders chose the option, in any field: one in use is not deleted.
SELECT count(DISTINCT v.order_id) FROM order_values v
JOIN orders t ON t.id = v.order_id
WHERE v.option_id = $1 AND t.deleted_at IS NULL;

-- name: AddOrderHistory :exec
-- Writes down what a member did to an order: created, updated (a move too) or
-- deleted. changes is what an edit changed, each thing as text under the
-- names of that time; actor_name is the name the member goes by in the
-- company now.
INSERT INTO order_history (order_id, action, actor_phone, actor_name, changes)
VALUES (sqlc.arg('order_id'), sqlc.arg('action'), sqlc.arg('actor_phone'), sqlc.narg('actor_name'), sqlc.arg('changes'));

-- name: ListOrderHistory :many
-- What happened to the order, the latest first. actor_name is the name the
-- member who did it goes by in the company now; once they have left it (or
-- go by no name), the name of then.
SELECT h.id, h.action, COALESCE(m.full_name, h.actor_name) AS actor_name, h.changes, h.created_at
FROM order_history h
JOIN orders t ON t.id = h.order_id
LEFT JOIN user_companies m ON m.user_phone = h.actor_phone AND m.company_id = t.company_id
WHERE h.order_id = $1
ORDER BY h.id DESC;
