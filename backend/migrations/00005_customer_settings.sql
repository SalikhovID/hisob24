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

-- +goose Down
DROP TABLE customer_dropdown_options;
DROP TABLE customer_dropdowns;
