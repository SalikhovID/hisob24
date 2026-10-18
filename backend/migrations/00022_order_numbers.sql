-- +goose Up
-- An order is numbered in its company, not named (logic/orders.md, 3.3;
-- docs/superpowers/specs/2026-10-18-order-number-design.md): the orders
-- there are take their numbers in the order they were entered, the
-- deleted among them (a number is never given twice), and their names go.
ALTER TABLE orders ADD COLUMN number INT;
UPDATE orders o SET number = r.n
FROM (SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY id) AS n FROM orders) r
WHERE r.id = o.id;
ALTER TABLE orders ALTER COLUMN number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_company_id_number_key UNIQUE (company_id, number);
ALTER TABLE orders DROP COLUMN title;

-- +goose Down
-- The names are gone for good: the column comes back empty.
ALTER TABLE orders ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE orders DROP CONSTRAINT orders_company_id_number_key;
ALTER TABLE orders DROP COLUMN number;
