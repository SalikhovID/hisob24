-- The home's blocks at a glance
-- (docs/superpowers/specs/2026-11-03-flat-redesign-design.md). The sales
-- and the customers' debt are in so'm, each document turned by its own rate
-- row (logic/currencies.md, section 4); the accounts in their own currency.

-- name: DashboardOrders :one
-- The company's orders in the locations given not done yet, and how many of
-- them are past their deadline (before today).
SELECT count(*) AS active, count(*) FILTER (WHERE t.deadline < sqlc.arg('today')::date) AS late
FROM orders t
JOIN order_stages s ON s.id = t.stage_id
WHERE t.company_id = sqlc.arg('company_id') AND t.deleted_at IS NULL AND NOT s.is_done
  AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[]);

-- name: DashboardOrdersByStage :many
-- How many of the company's orders in the locations given stand in each of
-- its stages not done, in the stages' order, the empty ones too.
SELECT s.id AS stage_id, count(t.id) AS count
FROM order_stages s
LEFT JOIN orders t ON t.stage_id = s.id AND t.deleted_at IS NULL AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL AND NOT s.is_done
GROUP BY s.id, s.position
ORDER BY s.position, s.id;

-- name: DashboardMoneyByDay :many
-- The company's live documents of the kind in the locations given on each
-- day of the month up to today, the days counted in the zone: their total
-- in so'm, each by its own rate row, and how many, both by the day's end.
-- An order's document counts when it is priced (total above 0).
SELECT d.day::date AS day,
       COALESCE(sum(x.total) OVER (ORDER BY d.day), 0)::numeric(14,2) AS total,
       COALESCE(sum(x.count) OVER (ORDER BY d.day), 0)::bigint AS count
FROM generate_series(sqlc.arg('month_start')::date, sqlc.arg('today')::date, interval '1 day') AS d(day)
LEFT JOIN (
    SELECT (t.doc_at AT TIME ZONE sqlc.arg('zone')::text)::date AS day,
           sum(convert_amount(t.total, t.currency_id, 1, cr)) AS total, count(*) AS count
    FROM transactions t
    JOIN currency_rates cr ON cr.id = t.currency_rate_id
    WHERE t.company_id = sqlc.arg('company_id') AND t.kind = sqlc.arg('kind')::text AND t.deleted_at IS NULL
      AND (t.kind <> 'order' OR t.total > 0)
      AND t.location_id = ANY(sqlc.arg('location_ids')::bigint[])
      AND (t.doc_at AT TIME ZONE sqlc.arg('zone')::text)::date BETWEEN sqlc.arg('month_start')::date AND sqlc.arg('today')::date
    GROUP BY 1
) x ON x.day = d.day::date
ORDER BY d.day;

-- name: DashboardCash :many
-- What the company's live accounts (the turned off ones too) hold, summed
-- by currency, each account's by the rule of ListAccountBalances: nothing
-- is turned into another currency; a currency that comes to 0 is left out.
WITH balances AS (
    SELECT b.currency_id,
           COALESCE(sum(CASE
               WHEN t.kind IN ('cash_opening', 'income', 'customer_payment') THEN t.total
               WHEN t.kind IN ('expense', 'supplier_payment') THEN -t.total
               WHEN t.kind = 'money_transfer' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.total END
               WHEN t.kind = 'conversion' THEN CASE WHEN t.bank_account_id = b.id THEN -t.total ELSE t.to_total END
               ELSE 0 END), 0)::numeric(14,2) AS balance
    FROM bank_accounts b
    LEFT JOIN transactions t ON (t.bank_account_id = b.id OR t.to_bank_account_id = b.id) AND t.deleted_at IS NULL
    WHERE b.company_id = sqlc.arg('company_id') AND b.deleted_at IS NULL
    GROUP BY b.id
)
SELECT currency_id, sum(balance)::numeric(14,2) AS amount
FROM balances
GROUP BY currency_id
HAVING sum(balance) <> 0
ORDER BY currency_id;

-- name: DashboardAccounts :one
-- How many live accounts the company has, the turned off ones too.
SELECT count(*) FROM bank_accounts WHERE company_id = sqlc.arg('company_id') AND deleted_at IS NULL;

-- name: DashboardDebtors :one
-- What the company's live customers owe: the so'm balances above zero
-- summed and counted. A balance is the customer list's (logic/sales.md,
-- section 5): sales, orders' documents and opening debts add, payments and
-- opening advances take away, each by its own rate row.
WITH balances AS (
    SELECT COALESCE(sum(CASE WHEN d.kind IN ('sale', 'customer_debt', 'order') THEN convert_amount(d.total, d.currency_id, 1, cr)
                             ELSE -convert_amount(d.total, d.currency_id, 1, cr) END), 0) AS balance
    FROM customers c
    LEFT JOIN transactions d ON d.customer_id = c.id AND d.deleted_at IS NULL
    LEFT JOIN currency_rates cr ON cr.id = d.currency_rate_id
    WHERE c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL
    GROUP BY c.id
)
SELECT COALESCE(sum(b.balance) FILTER (WHERE b.balance > 0), 0)::numeric(14,2) AS debt,
       count(*) FILTER (WHERE b.balance > 0) AS debtors
FROM balances b;

-- name: DashboardLowStock :many
-- The company's live active products (no service) moved in the locations
-- given whose stock there, summed, is at_most or less (logic/warehouse.md,
-- section 5), by name whatever the case: the first `limit` of them, each
-- row carrying how many there are in all.
SELECT p.name, count(*) OVER () AS total
FROM products p
JOIN (
    SELECT sm.product_id, sum(sm.quantity) AS quantity
    FROM stock_moves sm
    WHERE sm.company_id = sqlc.arg('company_id') AND sm.location_id = ANY(sqlc.arg('location_ids')::bigint[])
    GROUP BY sm.product_id
) s ON s.product_id = p.id
WHERE p.company_id = sqlc.arg('company_id') AND p.deleted_at IS NULL AND p.is_active AND p.kind = 'product'
  AND s.quantity <= sqlc.arg('at_most')::int
ORDER BY lower(p.name), p.id
LIMIT sqlc.arg('limit');
