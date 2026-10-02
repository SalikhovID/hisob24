-- name: CreateBilling :one
INSERT INTO billings (company_id, days, amount, prev_end_date, new_end_date, note, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
