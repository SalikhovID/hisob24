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
