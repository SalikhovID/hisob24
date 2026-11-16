-- +goose Up
-- A company's categories of its products (logic/products.md, 3.4): one
-- level, a product under one or none, a service under none. Nothing is ever
-- removed: deleted_at hides a category, and its name is free again.
CREATE TABLE product_categories (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,
    -- Where it stands in the company's order: the settings', the forms' and
    -- the filters'.
    position   INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    -- What a product's key points at: a product and its category are one
    -- company's.
    UNIQUE (company_id, id)
);
-- A name is one live category's in the company, whatever the case.
CREATE UNIQUE INDEX product_categories_name ON product_categories (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A product's category, when it has one; a service has none.
ALTER TABLE products
    ADD COLUMN category_id BIGINT,
    ADD CONSTRAINT products_category FOREIGN KEY (company_id, category_id) REFERENCES product_categories (company_id, id),
    ADD CONSTRAINT products_category_kind CHECK (kind = 'product' OR category_id IS NULL);
CREATE INDEX products_by_category ON products (company_id, category_id) WHERE deleted_at IS NULL;

-- The products there are go into «Asosiy»: every company with a live
-- product (an inactive one too) gets it, first in its order, and its live
-- products are filed under it. A service, a deleted product and a company
-- with no live product get none. Filing is no edit: updated_at stays.
INSERT INTO product_categories (company_id, name, position)
SELECT DISTINCT company_id, 'Asosiy', 1 FROM products WHERE kind = 'product' AND deleted_at IS NULL;
UPDATE products p SET category_id = c.id
FROM product_categories c
WHERE c.company_id = p.company_id AND p.kind = 'product' AND p.deleted_at IS NULL;

-- +goose Down
ALTER TABLE products DROP COLUMN category_id;
DROP TABLE product_categories;
