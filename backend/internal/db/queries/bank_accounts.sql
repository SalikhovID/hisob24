-- name: CreateBankAccount :one
-- Adds an account of the company in the currency; 23505 when the name is
-- another live account's (whatever the case).
INSERT INTO bank_accounts (company_id, name, currency_id, created_by)
VALUES (sqlc.arg('company_id'), sqlc.arg('name'), sqlc.arg('currency_id'), sqlc.narg('created_by'))
RETURNING *;

-- name: ListBankAccounts :many
-- The company's live accounts, in the order they were added.
SELECT * FROM bank_accounts WHERE company_id = $1 AND deleted_at IS NULL ORDER BY id;

-- name: GetBankAccount :one
-- The company's live account; pgx.ErrNoRows when it has none such, or
-- deleted it.
SELECT * FROM bank_accounts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: UpdateBankAccount :one
-- Changes the name, the currency and the active flag; a NULL argument
-- leaves its column as it is. pgx.ErrNoRows when the company has no such
-- account, or deleted it; 23505 when the name is another's.
UPDATE bank_accounts
SET name = COALESCE(sqlc.narg('name'), name),
    currency_id = COALESCE(sqlc.narg('currency_id'), currency_id),
    is_active = COALESCE(sqlc.narg('is_active'), is_active),
    updated_at = now()
WHERE id = sqlc.arg('id') AND company_id = sqlc.arg('company_id') AND deleted_at IS NULL
RETURNING *;

-- name: DeleteBankAccount :one
-- Hides the account: nothing is removed, its name is free again.
-- pgx.ErrNoRows when the company has no such account, or deleted it already.
UPDATE bank_accounts SET deleted_at = now()
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
RETURNING id;

-- name: CountActiveBankAccounts :one
-- How many live, active accounts the company has: one has to stay.
SELECT count(*) FROM bank_accounts WHERE company_id = $1 AND deleted_at IS NULL AND is_active;
