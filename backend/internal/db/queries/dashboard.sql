-- The home's blocks at a glance
-- (docs/superpowers/specs/2026-10-13-mini-app-ui-design.md). Money is in
-- so'm, each document turned by its own rate row (logic/currencies.md,
-- section 4), as a supplier's balance is.

-- name: DashboardSuppliers :one
-- What the company's live suppliers are owed: the so'm balances above zero
-- summed and counted, and those below zero (the advances) summed as a
-- positive amount. A balance is the supplier list's: purchases and opening
-- debts add, payments and opening advances take away.
WITH balances AS (
    SELECT COALESCE(sum(CASE WHEN d.kind IN ('purchase', 'supplier_debt') THEN convert_amount(d.total, d.currency_id, 1, cr)
                             ELSE -convert_amount(d.total, d.currency_id, 1, cr) END), 0) AS balance
    FROM suppliers s
    LEFT JOIN transactions d ON d.supplier_id = s.id AND d.deleted_at IS NULL
    LEFT JOIN currency_rates cr ON cr.id = d.currency_rate_id
    WHERE s.company_id = sqlc.arg('company_id') AND s.deleted_at IS NULL
    GROUP BY s.id
)
SELECT COALESCE(sum(b.balance) FILTER (WHERE b.balance > 0), 0)::numeric(14,2) AS debt,
       count(*) FILTER (WHERE b.balance > 0) AS debtors,
       COALESCE(-sum(b.balance) FILTER (WHERE b.balance < 0), 0)::numeric(14,2) AS advance
FROM balances b;

-- name: DashboardCustomersByDay :many
-- The company's live customers on each day of the month up to today, the
-- days counted in the zone: how many there were before the month, and how
-- many by the day's end.
SELECT d.day::date AS day, b.before::bigint AS before,
       (b.before + COALESCE(sum(x.added) OVER (ORDER BY d.day), 0))::bigint AS total
FROM generate_series(sqlc.arg('month_start')::date, sqlc.arg('today')::date, interval '1 day') AS d(day)
CROSS JOIN (
    SELECT count(*) AS before FROM customers c
    WHERE c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL
      AND (c.created_at AT TIME ZONE sqlc.arg('zone')::text)::date < sqlc.arg('month_start')::date
) b
LEFT JOIN (
    SELECT (c.created_at AT TIME ZONE sqlc.arg('zone')::text)::date AS day, count(*) AS added
    FROM customers c
    WHERE c.company_id = sqlc.arg('company_id') AND c.deleted_at IS NULL
      AND (c.created_at AT TIME ZONE sqlc.arg('zone')::text)::date BETWEEN sqlc.arg('month_start')::date AND sqlc.arg('today')::date
    GROUP BY 1
) x ON x.day = d.day::date
ORDER BY d.day;
