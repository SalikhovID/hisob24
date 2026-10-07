-- +goose Up
-- A company's products and services (logic/products.md): a product is a
-- good bought into the stock, with a unit; a service is offered, with no
-- unit and no SKU. Nothing here is ever removed: deleted_at hides a row, and
-- its name and SKU are free again. An inactive row stays, but is no longer
-- offered.
CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    kind            TEXT NOT NULL CHECK (kind IN ('product', 'service')),
    name            TEXT NOT NULL,
    unit            TEXT CHECK (unit IN ('dona', 'kg', 'g', 'l', 'ml', 'm', 'm2', 'quti', 'juft', 'komplekt')),
    sku             TEXT,
    -- The sale price of a product, the price of a service; may be none.
    price           NUMERIC(14,2) CHECK (price >= 0),
    note            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    -- What a purchase line's and the stock's foreign keys point at: a
    -- product and its purchase are one company's.
    UNIQUE (company_id, id),
    -- A product has a unit, a service has none; only a product has a SKU.
    CHECK ((kind = 'product') = (unit IS NOT NULL)),
    CHECK (kind = 'product' OR sku IS NULL)
);
-- A name is one product's among the company's products, one service's among
-- its services (whatever the case); a SKU is one product's in the company.
CREATE UNIQUE INDEX products_name ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX products_sku ON products (company_id, lower(sku)) WHERE deleted_at IS NULL AND sku IS NOT NULL;
CREATE INDEX products_list ON products (company_id, kind, lower(name)) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE products;
