-- +goose Up
-- The currencies (logic/currencies.md): a fixed catalog (the so'm first),
-- the ones each company has turned on (the so'm always), the rates a
-- company keeps over time and the conversion every sum goes through.
CREATE TABLE currencies (
    id       BIGSERIAL PRIMARY KEY,
    code     TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{3}$'),
    name     TEXT NOT NULL,
    symbol   TEXT NOT NULL,
    position INT NOT NULL
);
INSERT INTO currencies (id, code, name, symbol, position) VALUES
    (1, 'UZS', 'O''zbek so''mi', 'so''m', 1),
    (2, 'USD', 'AQSH dollari', '$', 2),
    (3, 'EUR', 'Yevro', '€', 3),
    (4, 'RUB', 'Rossiya rubli', '₽', 4);
SELECT setval('currencies_id_seq', 4);

-- The currencies a company has turned on; every company starts with the
-- so'm (company.Create for a new one), which is never turned off.
CREATE TABLE company_currencies (
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    currency_id BIGINT NOT NULL REFERENCES currencies(id),
    added_by    BIGINT REFERENCES admins(telegram_id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, currency_id)
);
INSERT INTO company_currencies (company_id, currency_id) SELECT id, 1 FROM companies;

-- A rate row holds every currency's rate against the so'm at a moment
-- ("1 USD = 12800 so'm"; a currency not turned on stays 0), the way
-- tw-dobroe's currency_rate does: status 1 is a standard row entered in the
-- settings, 2 a document's own rate. A document points at the row it was
-- converted by, so the rates of then never move under it.
CREATE TABLE currency_rates (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    uzs         NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (uzs = 1),
    usd         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (usd >= 0),
    eur         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (eur >= 0),
    rub         NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (rub >= 0),
    status      SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
    set_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    set_by_name TEXT,
    set_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX currency_rates_standard ON currency_rates (company_id, set_at DESC, id DESC) WHERE status = 1;

-- convert_amount turns an amount of one currency into another by a rate
-- row, two decimals; NULL when the target has no rate in the row.
-- +goose StatementBegin
CREATE FUNCTION convert_amount(p_amount NUMERIC, p_from BIGINT, p_to BIGINT, r currency_rates) RETURNS NUMERIC
LANGUAGE SQL IMMUTABLE AS $$
    SELECT round(p_amount
        * CASE p_from WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END
        / NULLIF(CASE p_to WHEN 1 THEN r.uzs WHEN 2 THEN r.usd WHEN 3 THEN r.eur WHEN 4 THEN r.rub END, 0), 2)
$$;
-- +goose StatementEnd

-- A price is in a currency (the so'm unless said otherwise); a user has a
-- time zone the documents' moments are shown in.
ALTER TABLE products ADD COLUMN currency_id BIGINT NOT NULL DEFAULT 1 REFERENCES currencies(id);
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent';

-- +goose Down
ALTER TABLE users DROP COLUMN timezone;
ALTER TABLE products DROP COLUMN currency_id;
DROP FUNCTION convert_amount(NUMERIC, BIGINT, BIGINT, currency_rates);
DROP TABLE currency_rates;
DROP TABLE company_currencies;
DROP TABLE currencies;
