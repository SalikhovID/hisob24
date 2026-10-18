-- +goose Up
-- An order's money and goods are a document of the journal (logic/orders.md,
-- 4.3; the design in docs/superpowers/specs/2026-10-18-order-money-design.md):
-- of the kind order, naming its order (one live document per order), its
-- customer and its location. Its total is the order's price, its lines the
-- goods, its moves their way out of the stock; the customer's payments
-- entered for the order link to it.
ALTER TABLE orders ADD CONSTRAINT orders_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE transactions ADD COLUMN order_id BIGINT;
ALTER TABLE transactions ADD CONSTRAINT transactions_company_id_order_id_fkey FOREIGN KEY (company_id, order_id) REFERENCES orders (company_id, id);
CREATE UNIQUE INDEX transactions_order ON transactions (order_id) WHERE kind = 'order' AND deleted_at IS NULL;

ALTER TABLE transactions DROP CONSTRAINT transactions_kind_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_check CHECK (kind IN (
    'purchase', 'sale', 'transfer', 'inventory', 'opening_stock', 'order',
    'supplier_payment', 'supplier_debt', 'supplier_prepay',
    'customer_payment', 'customer_debt', 'customer_prepay',
    'cash_opening', 'expense', 'income', 'money_transfer', 'conversion'));
ALTER TABLE transactions DROP CONSTRAINT transactions_kind_fields;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_fields CHECK (
    CASE kind
        WHEN 'purchase'         THEN location_id IS NOT NULL AND supplier_id IS NOT NULL
        WHEN 'sale'             THEN location_id IS NOT NULL
        WHEN 'transfer'         THEN location_id IS NOT NULL AND to_location_id IS NOT NULL AND to_location_id <> location_id
        WHEN 'inventory'        THEN location_id IS NOT NULL
        WHEN 'opening_stock'    THEN location_id IS NOT NULL
        WHEN 'order'            THEN order_id IS NOT NULL AND customer_id IS NOT NULL AND location_id IS NOT NULL
        WHEN 'supplier_payment' THEN supplier_id IS NOT NULL AND bank_account_id IS NOT NULL AND total > 0
        WHEN 'supplier_debt'    THEN supplier_id IS NOT NULL AND total > 0
        WHEN 'supplier_prepay'  THEN supplier_id IS NOT NULL AND total > 0
        WHEN 'customer_payment' THEN bank_account_id IS NOT NULL AND (customer_id IS NOT NULL OR linked_id IS NOT NULL) AND total > 0
        WHEN 'customer_debt'    THEN customer_id IS NOT NULL AND total > 0
        WHEN 'customer_prepay'  THEN customer_id IS NOT NULL AND total > 0
        WHEN 'cash_opening'     THEN bank_account_id IS NOT NULL AND total > 0
        WHEN 'expense'          THEN bank_account_id IS NOT NULL AND category_id IS NOT NULL AND total > 0
        WHEN 'income'           THEN bank_account_id IS NOT NULL AND category_id IS NOT NULL AND total > 0
        WHEN 'money_transfer'   THEN bank_account_id IS NOT NULL AND to_bank_account_id IS NOT NULL AND to_bank_account_id <> bank_account_id AND total > 0
        WHEN 'conversion'       THEN bank_account_id IS NOT NULL AND to_bank_account_id IS NOT NULL AND to_bank_account_id <> bank_account_id AND total > 0 AND to_total IS NOT NULL
    END
);

-- +goose Down
-- The order documents go, with their lines, their moves and the payments
-- linked to them; the rules are the ones of 00016 again.
DELETE FROM stock_moves WHERE transaction_id IN (SELECT id FROM transactions WHERE kind = 'order');
DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE kind = 'order');
DELETE FROM transactions WHERE linked_id IN (SELECT id FROM transactions WHERE kind = 'order');
DELETE FROM transactions WHERE kind = 'order';
ALTER TABLE transactions DROP CONSTRAINT transactions_kind_fields;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_fields CHECK (
    CASE kind
        WHEN 'purchase'         THEN location_id IS NOT NULL AND supplier_id IS NOT NULL
        WHEN 'sale'             THEN location_id IS NOT NULL
        WHEN 'transfer'         THEN location_id IS NOT NULL AND to_location_id IS NOT NULL AND to_location_id <> location_id
        WHEN 'inventory'        THEN location_id IS NOT NULL
        WHEN 'opening_stock'    THEN location_id IS NOT NULL
        WHEN 'supplier_payment' THEN supplier_id IS NOT NULL AND bank_account_id IS NOT NULL AND total > 0
        WHEN 'supplier_debt'    THEN supplier_id IS NOT NULL AND total > 0
        WHEN 'supplier_prepay'  THEN supplier_id IS NOT NULL AND total > 0
        WHEN 'customer_payment' THEN bank_account_id IS NOT NULL AND (customer_id IS NOT NULL OR linked_id IS NOT NULL) AND total > 0
        WHEN 'customer_debt'    THEN customer_id IS NOT NULL AND total > 0
        WHEN 'customer_prepay'  THEN customer_id IS NOT NULL AND total > 0
        WHEN 'cash_opening'     THEN bank_account_id IS NOT NULL AND total > 0
        WHEN 'expense'          THEN bank_account_id IS NOT NULL AND category_id IS NOT NULL AND total > 0
        WHEN 'income'           THEN bank_account_id IS NOT NULL AND category_id IS NOT NULL AND total > 0
        WHEN 'money_transfer'   THEN bank_account_id IS NOT NULL AND to_bank_account_id IS NOT NULL AND to_bank_account_id <> bank_account_id AND total > 0
        WHEN 'conversion'       THEN bank_account_id IS NOT NULL AND to_bank_account_id IS NOT NULL AND to_bank_account_id <> bank_account_id AND total > 0 AND to_total IS NOT NULL
    END
);
ALTER TABLE transactions DROP CONSTRAINT transactions_kind_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_check CHECK (kind IN (
    'purchase', 'sale', 'transfer', 'inventory', 'opening_stock',
    'supplier_payment', 'supplier_debt', 'supplier_prepay',
    'customer_payment', 'customer_debt', 'customer_prepay',
    'cash_opening', 'expense', 'income', 'money_transfer', 'conversion'));
DROP INDEX transactions_order;
ALTER TABLE transactions DROP COLUMN order_id;
ALTER TABLE orders DROP CONSTRAINT orders_company_id_id_key;
