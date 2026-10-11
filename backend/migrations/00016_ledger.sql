-- +goose Up
-- The journal (logic/warehouse.md, section 1; the design in
-- docs/superpowers/specs/2026-10-11-ledger-design.md): every document of a
-- company is one row of transactions, of a kind, numbered in the company
-- within its kind, at a moment, in a currency with a rate row of the
-- company. What the kind needs besides is checked below. Nothing is ever
-- removed: deleted_at hides a document.
CREATE TABLE transactions (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    kind               TEXT NOT NULL CHECK (kind IN (
                           'purchase', 'sale', 'transfer', 'inventory', 'opening_stock',
                           'supplier_payment', 'supplier_debt', 'supplier_prepay',
                           'customer_payment', 'customer_debt', 'customer_prepay',
                           'cash_opening', 'expense', 'income', 'money_transfer', 'conversion')),
    number             INT NOT NULL,
    doc_at             TIMESTAMPTZ NOT NULL,
    location_id        BIGINT,
    to_location_id     BIGINT,
    supplier_id        BIGINT,
    customer_id        BIGINT,
    bank_account_id    BIGINT,
    to_bank_account_id BIGINT,
    category_id        BIGINT,
    linked_id          BIGINT REFERENCES transactions(id),
    currency_id        BIGINT NOT NULL DEFAULT 1 REFERENCES currencies(id),
    currency_rate_id   BIGINT NOT NULL REFERENCES currency_rates(id),
    total              NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    to_total           NUMERIC(14,2) CHECK (to_total > 0),
    note               TEXT,
    created_by         TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    UNIQUE (company_id, id),
    UNIQUE (company_id, kind, number),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, to_location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id),
    FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id),
    FOREIGN KEY (company_id, bank_account_id) REFERENCES bank_accounts (company_id, id),
    FOREIGN KEY (company_id, to_bank_account_id) REFERENCES bank_accounts (company_id, id),
    FOREIGN KEY (company_id, category_id) REFERENCES finance_categories (company_id, id),
    -- What each kind names: a goods document its location (a transfer its
    -- other location too), a supplier's or a customer's money document its
    -- party, a money document its account (a transfer or a conversion the
    -- other account too) and an amount above zero.
    CONSTRAINT transactions_kind_fields CHECK (
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
    )
);
CREATE INDEX transactions_newest ON transactions (company_id, kind, doc_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_location ON transactions (location_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_to_location ON transactions (to_location_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_supplier ON transactions (supplier_id, doc_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_customer ON transactions (customer_id, doc_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_account ON transactions (bank_account_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_to_account ON transactions (to_bank_account_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_category ON transactions (category_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_linked ON transactions (linked_id) WHERE linked_id IS NOT NULL;

-- A line of a goods document: a product once per document, the quantity
-- entered (counted, in an inventory, with the stock expected then), a price
-- in the document's currency where the kind has one. position is the order
-- the lines were entered in.
CREATE TABLE transaction_items (
    transaction_id BIGINT NOT NULL REFERENCES transactions(id),
    product_id     BIGINT NOT NULL REFERENCES products(id),
    quantity       NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
    expected       NUMERIC(14,3),
    price          NUMERIC(14,2) CHECK (price >= 0),
    position       INT NOT NULL,
    PRIMARY KEY (transaction_id, product_id)
);
CREATE INDEX transaction_items_product ON transaction_items (product_id);

-- The stock journal: what a document moved in a location, in (above zero)
-- or out (below). The stock of a product in a location is the sum of its
-- moves; the service writes them from the lines and removes a hidden
-- document's.
CREATE TABLE stock_moves (
    id             BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id),
    company_id     BIGINT NOT NULL,
    location_id    BIGINT NOT NULL,
    product_id     BIGINT NOT NULL,
    quantity       NUMERIC(14,3) NOT NULL CHECK (quantity <> 0),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id)
);
CREATE INDEX stock_moves_stock ON stock_moves (location_id, product_id) INCLUDE (quantity);
CREATE INDEX stock_moves_product ON stock_moves (product_id, location_id);
CREATE INDEX stock_moves_transaction ON stock_moves (transaction_id);

-- The purchases and the payments so far move into the journal. Every
-- document names a rate row: a company that has set no rates yet gets its
-- zero row (status 2: a document's own, kept out of the history), set by
-- its owner, or whoever entered its first purchase or payment.
INSERT INTO currency_rates (company_id, status, set_by)
SELECT c.id, 2, COALESCE(
    (SELECT uc.user_phone FROM user_companies uc WHERE uc.company_id = c.id ORDER BY (uc.role = 'owner') DESC, uc.user_phone LIMIT 1),
    (SELECT p.created_by FROM purchases p WHERE p.company_id = c.id ORDER BY p.id LIMIT 1),
    (SELECT sp.created_by FROM supplier_payments sp WHERE sp.company_id = c.id ORDER BY sp.id LIMIT 1))
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM currency_rates r WHERE r.company_id = c.id)
  AND (EXISTS (SELECT 1 FROM purchases p WHERE p.company_id = c.id) OR EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.company_id = c.id));

-- A purchase keeps its id and number; its day becomes midnight in Tashkent;
-- it is in so'm with the company's first standard rate row, or its zero row.
INSERT INTO transactions (id, company_id, kind, number, doc_at, location_id, supplier_id, currency_id, currency_rate_id, total, note,
                          created_by, created_by_name, created_at, updated_at, deleted_at)
SELECT p.id, p.company_id, 'purchase', p.number, (p.purchased_on::timestamp AT TIME ZONE 'Asia/Tashkent'), p.location_id, p.supplier_id, 1,
       (SELECT r.id FROM currency_rates r WHERE r.company_id = p.company_id ORDER BY (r.status = 1) DESC, r.set_at, r.id LIMIT 1),
       p.total, p.note, p.created_by, p.created_by_name, p.created_at, p.updated_at, p.deleted_at
FROM purchases p
ORDER BY p.id;
SELECT setval('transactions_id_seq', GREATEST((SELECT COALESCE(max(id), 0) FROM transactions), 1), (SELECT count(*) > 0 FROM transactions));

INSERT INTO transaction_items (transaction_id, product_id, quantity, price, position)
SELECT i.purchase_id, i.product_id, i.quantity, i.price, i.position FROM purchase_items i;

-- The live purchases' lines are the moves so far: the stock stays what it was.
INSERT INTO stock_moves (transaction_id, company_id, location_id, product_id, quantity)
SELECT i.purchase_id, p.company_id, p.location_id, i.product_id, i.quantity
FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
WHERE p.deleted_at IS NULL
ORDER BY p.id, i.position;

-- A payment takes a new id, is numbered by day in the company, comes out of
-- the company's cash (its first live account otherwise) and stays linked to
-- the purchase it was entered with.
INSERT INTO transactions (company_id, kind, number, doc_at, supplier_id, bank_account_id, linked_id, currency_id, currency_rate_id, total, note,
                          created_by, created_by_name, created_at, updated_at, deleted_at)
SELECT sp.company_id, 'supplier_payment', row_number() OVER (PARTITION BY sp.company_id ORDER BY sp.paid_on, sp.id),
       (sp.paid_on::timestamp AT TIME ZONE 'Asia/Tashkent'), sp.supplier_id,
       (SELECT b.id FROM bank_accounts b WHERE b.company_id = sp.company_id AND b.deleted_at IS NULL ORDER BY (lower(b.name) = 'naqd') DESC, b.id LIMIT 1),
       sp.purchase_id, 1,
       (SELECT r.id FROM currency_rates r WHERE r.company_id = sp.company_id ORDER BY (r.status = 1) DESC, r.set_at, r.id LIMIT 1),
       sp.amount, sp.note, sp.created_by, sp.created_by_name, sp.created_at, sp.updated_at, sp.deleted_at
FROM supplier_payments sp
ORDER BY sp.company_id, sp.paid_on, sp.id;

DROP TABLE supplier_payments;
DROP TABLE stock;
DROP TABLE purchase_items;
DROP TABLE purchases;

-- +goose Down
DROP TABLE stock_moves;
DROP TABLE transaction_items;
DROP TABLE transactions;

-- The tables of 00013 come back, empty.
CREATE TABLE purchases (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    number          INT NOT NULL,
    location_id     BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchased_on    DATE NOT NULL,
    note            TEXT,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id),
    UNIQUE (company_id, number),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE INDEX purchases_newest ON purchases (company_id, purchased_on DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX purchases_supplier ON purchases (supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX purchases_location ON purchases (location_id) WHERE deleted_at IS NULL;
CREATE TABLE purchase_items (
    purchase_id BIGINT NOT NULL REFERENCES purchases(id),
    product_id  BIGINT NOT NULL REFERENCES products(id),
    quantity    NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    price       NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    position    INT NOT NULL,
    PRIMARY KEY (purchase_id, product_id)
);
CREATE INDEX purchase_items_product ON purchase_items (product_id);
CREATE TABLE stock (
    company_id  BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (location_id, product_id),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id)
);
CREATE TABLE supplier_payments (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL,
    supplier_id     BIGINT NOT NULL,
    purchase_id     BIGINT REFERENCES purchases(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    paid_on         DATE NOT NULL,
    note            TEXT,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id)
);
CREATE UNIQUE INDEX supplier_payments_purchase ON supplier_payments (purchase_id) WHERE purchase_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX supplier_payments_newest ON supplier_payments (supplier_id, paid_on DESC, id DESC) WHERE deleted_at IS NULL;
