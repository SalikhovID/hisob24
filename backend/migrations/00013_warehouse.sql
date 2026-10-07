-- +goose Up
-- The warehouse (logic/warehouse.md): the suppliers a company buys from,
-- its purchases (one supplier, one location, lines of products), the stock
-- of every product in every location, and the payments to the suppliers.
-- Nothing here is ever removed: deleted_at hides a row. Amounts are so'm
-- with two decimals, quantities have three.

-- A supplier: a name (one live supplier's in the company, whatever the
-- case), a phone (an Uzbek number, as the users' phones are kept) and a
-- note. An inactive supplier stays but is offered to no new purchase.
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    name            TEXT NOT NULL,
    phone           TEXT CHECK (phone ~ '^998[0-9]{9}$'),
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX suppliers_name ON suppliers (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A purchase: numbered in the company from 1 (a deleted purchase keeps its
-- number), in one of the company's locations, from one of its suppliers,
-- on a day. total is the sum of its lines, kept by the service.
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

-- A line of a purchase: a product once per purchase, a quantity above zero
-- and a price. position is the order the lines were entered in.
CREATE TABLE purchase_items (
    purchase_id BIGINT NOT NULL REFERENCES purchases(id),
    product_id  BIGINT NOT NULL REFERENCES products(id),
    quantity    NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    price       NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    position    INT NOT NULL,
    PRIMARY KEY (purchase_id, product_id)
);
CREATE INDEX purchase_items_product ON purchase_items (product_id);

-- The stock of a product in a location, changed by the purchases alone and
-- never below zero (stock_quantity_check is what the service tells a
-- refusal by).
CREATE TABLE stock (
    company_id  BIGINT NOT NULL,
    location_id BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    PRIMARY KEY (location_id, product_id),
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id),
    FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id)
);

-- A payment to a supplier. One entered with a purchase is linked to it
-- (purchase_id): a purchase holds at most one live payment, which is
-- changed through the purchase alone.
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

-- +goose Down
DROP TABLE supplier_payments;
DROP TABLE stock;
DROP TABLE purchase_items;
DROP TABLE purchases;
DROP TABLE suppliers;
