-- name: CreateCustomerDropdown :one
INSERT INTO customer_dropdowns (company_id, name)
VALUES ($1, $2)
RETURNING *;
