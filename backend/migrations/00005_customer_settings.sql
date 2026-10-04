-- +goose Up
-- A dropdown is a list of options the company's owner makes in the settings;
-- a choice field of a customer type takes its options from one. Nothing here
-- is ever removed: deleted_at hides a row, and its name is free again.
CREATE TABLE customer_dropdowns (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    -- What a field's foreign key points at: a field and its dropdown are one
    -- company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX customer_dropdowns_name ON customer_dropdowns (company_id, lower(name)) WHERE deleted_at IS NULL;

-- position orders a dropdown's options. An option that is not active is no
-- longer offered, but stays on the customers who chose it.
CREATE TABLE customer_dropdown_options (
    id           BIGSERIAL PRIMARY KEY,
    dropdown_id  BIGINT NOT NULL REFERENCES customer_dropdowns(id),
    label        TEXT NOT NULL,
    position     INT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX customer_dropdown_options_label ON customer_dropdown_options (dropdown_id, lower(label)) WHERE deleted_at IS NULL;

-- A customer type (Jismoniy, Yuridik) decides what a customer's form asks.
-- position orders the company's types.
CREATE TABLE customer_types (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    position    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    -- What a field's and a customer's foreign keys point at: they are the
    -- type's company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX customer_types_name ON customer_types (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A field is one question of a type. The phone is not a field: every
-- customer has one. The choice kinds take their options from a dropdown;
-- only text and whole numbers may be told not to repeat.
CREATE TABLE customer_fields (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL,
    type_id      BIGINT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('string', 'int', 'dropdown', 'multi_dropdown', 'radio', 'checkbox')),
    dropdown_id  BIGINT,
    required     BOOLEAN NOT NULL DEFAULT false,
    is_unique    BOOLEAN NOT NULL DEFAULT false,
    position     INT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES customer_types (company_id, id),
    FOREIGN KEY (company_id, dropdown_id) REFERENCES customer_dropdowns (company_id, id),
    CHECK ((kind IN ('string', 'int')) = (dropdown_id IS NULL)),
    CHECK (NOT is_unique OR kind IN ('string', 'int'))
);
CREATE UNIQUE INDEX customer_fields_label ON customer_fields (type_id, lower(label)) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE customer_fields;
DROP TABLE customer_types;
DROP TABLE customer_dropdown_options;
DROP TABLE customer_dropdowns;
