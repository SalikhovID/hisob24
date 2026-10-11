-- +goose Up
-- The cash of a company (logic/finance.md): the accounts its money sits in
-- (a cash register, a bank account, a card), each in one currency, which
-- the admin keeps; every company starts with cash in so'm. And the
-- categories its expenses and its other income are filed under, which the
-- owner keeps in the settings. Nothing here is ever removed: deleted_at
-- hides a row, and its name is free again.
CREATE TABLE bank_accounts (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    currency_id BIGINT NOT NULL REFERENCES currencies(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  BIGINT REFERENCES admins(telegram_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX bank_accounts_name ON bank_accounts (company_id, lower(name)) WHERE deleted_at IS NULL;
INSERT INTO bank_accounts (company_id, name, currency_id) SELECT id, 'Naqd', 1 FROM companies;

CREATE TABLE finance_categories (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
    position   INT NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX finance_categories_name ON finance_categories (company_id, kind, lower(name)) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE finance_categories;
DROP TABLE bank_accounts;
