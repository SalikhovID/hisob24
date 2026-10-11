-- name: ListCurrencies :many
-- The catalog, the so'm first.
SELECT * FROM currencies ORDER BY position, id;

-- name: GetCurrency :one
-- A currency of the catalog; pgx.ErrNoRows for an id that is not one.
SELECT * FROM currencies WHERE id = $1;

-- name: ListCompanyCurrencies :many
-- The currencies the company has turned on, in the catalog's order.
SELECT c.* FROM currencies c
JOIN company_currencies cc ON cc.currency_id = c.id
WHERE cc.company_id = $1
ORDER BY c.position, c.id;

-- name: CompanyHasCurrency :one
-- Whether the company has the currency turned on.
SELECT EXISTS (SELECT 1 FROM company_currencies WHERE company_id = $1 AND currency_id = $2);

-- name: AddCompanyCurrency :exec
-- Turns a currency on for the company; one already on stays as it was.
INSERT INTO company_currencies (company_id, currency_id, added_by)
VALUES (sqlc.arg('company_id'), sqlc.arg('currency_id'), sqlc.narg('added_by'))
ON CONFLICT DO NOTHING;

-- name: RemoveCompanyCurrency :exec
-- Turns a currency off for the company.
DELETE FROM company_currencies WHERE company_id = $1 AND currency_id = $2;

-- name: CountCurrencyProducts :one
-- How many live products or services of the company carry their price in
-- the currency: what keeps it from being turned off.
SELECT count(*) FROM products WHERE company_id = $1 AND currency_id = $2 AND deleted_at IS NULL;

-- name: GetRateAt :one
-- The standard rate row in force at the moment: the newest set at or before
-- it. pgx.ErrNoRows before the company's first rate.
SELECT * FROM currency_rates
WHERE company_id = sqlc.arg('company_id') AND status = 1 AND set_at <= sqlc.arg('at')
ORDER BY set_at DESC, id DESC
LIMIT 1;

-- name: GetFirstRate :one
-- The company's earliest standard rate row: what a moment before any rate
-- falls back to. pgx.ErrNoRows when the company has none.
SELECT * FROM currency_rates WHERE company_id = $1 AND status = 1 ORDER BY set_at, id LIMIT 1;

-- name: GetRate :one
-- A rate row by id: what a document refers to.
SELECT * FROM currency_rates WHERE id = $1;

-- name: GetFallbackRate :one
-- The company's zero row: a document's own rate row (status 2, out of the
-- history) with no rate in it, what a document in so'm refers to while the
-- company has set no rates. pgx.ErrNoRows when there is none yet.
SELECT * FROM currency_rates WHERE company_id = $1 AND status = 2 AND usd = 0 AND eur = 0 AND rub = 0 ORDER BY id LIMIT 1;

-- name: CreateRate :one
-- Enters a rate row: a standard one (status 1) from the settings, or a
-- document's own (2). set_by_name is the name the member goes by in the
-- company now: it stays when they leave.
INSERT INTO currency_rates (company_id, usd, eur, rub, status, set_by, set_by_name)
VALUES (sqlc.arg('company_id'), sqlc.arg('usd'), sqlc.arg('eur'), sqlc.arg('rub'), sqlc.arg('status'), sqlc.arg('set_by'), sqlc.narg('set_by_name'))
RETURNING *;

-- name: ListRates :many
-- A page of the company's standard rate rows, the newest first, each with
-- the name the member who set it goes by now (the name of then once they
-- have left).
SELECT r.id, r.usd, r.eur, r.rub, r.set_at, COALESCE(m.full_name, r.set_by_name) AS set_by_name
FROM currency_rates r
LEFT JOIN user_companies m ON m.user_phone = r.set_by AND m.company_id = r.company_id
WHERE r.company_id = $1 AND r.status = 1
ORDER BY r.set_at DESC, r.id DESC
LIMIT $2 OFFSET $3;

-- name: CountRates :one
-- How many standard rate rows the company has, on all the pages.
SELECT count(*) FROM currency_rates WHERE company_id = $1 AND status = 1;

-- name: CountCurrencyBankAccounts :one
-- How many live accounts of the company are in the currency: what keeps
-- it from being turned off too.
SELECT count(*) FROM bank_accounts WHERE company_id = $1 AND currency_id = $2 AND deleted_at IS NULL;
