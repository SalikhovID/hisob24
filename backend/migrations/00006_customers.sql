-- +goose Up
-- A company's customers (logic/customers.md). A customer is of one type for
-- good and always has a phone, an Uzbek number. Nothing is removed: a deleted
-- customer is hidden with deleted_at, and its number is free again.
CREATE TABLE customers (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    type_id         BIGINT NOT NULL,
    phone           TEXT NOT NULL CHECK (phone ~ '^998[0-9]{9}$'),
    -- The member who entered the customer, and the name they went by in the
    -- company then: it is what stays when they leave the company.
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    -- A customer and its type belong to one company.
    FOREIGN KEY (company_id, type_id) REFERENCES customer_types (company_id, id)
);
CREATE UNIQUE INDEX customers_phone ON customers (company_id, phone) WHERE deleted_at IS NULL;
-- The list: the company's customers, the newest first.
CREATE INDEX customers_newest ON customers (company_id, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX customers_type ON customers (type_id);

-- +goose Down
DROP TABLE customers;
