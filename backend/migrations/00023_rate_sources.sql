-- +goose Up
-- The rates every night brings (logic/currencies.md, section 4): each
-- company takes them from a source the admin picks, the central bank
-- unless told otherwise, or enters them by hand ('manual'), and rounds the
-- dollar and the euro to a step (1 keeps them as the bank gives them).
ALTER TABLE companies
    ADD COLUMN rate_source TEXT NOT NULL DEFAULT 'cbu'
        CHECK (rate_source IN ('manual', 'cbu', 'kapitalbank', 'ipakyuli', 'asaka', 'hamkor', 'uzum', 'ofb')),
    ADD COLUMN rate_rounding INT NOT NULL DEFAULT 100 CHECK (rate_rounding IN (1, 10, 100, 1000));

-- A rate row the night's run wrote has no member: it says where it came
-- from instead, the bank it was taken from or yesterday's row ('carried'
-- for a company that enters its rates by hand, 'failed' when no bank
-- answered). A member's row has no source.
ALTER TABLE currency_rates
    ALTER COLUMN set_by DROP NOT NULL,
    ADD COLUMN source TEXT
        CHECK (source IN ('cbu', 'kapitalbank', 'ipakyuli', 'asaka', 'hamkor', 'uzum', 'ofb', 'carried', 'failed')),
    ADD CONSTRAINT currency_rates_author CHECK ((set_by IS NULL) <> (source IS NULL));

-- +goose Down
-- The run's rows become the owner's, as a document may point at them; a
-- company with no owner has none to give them, and its rows go.
ALTER TABLE currency_rates DROP CONSTRAINT currency_rates_author;
UPDATE currency_rates r SET set_by = m.user_phone
FROM user_companies m
WHERE r.set_by IS NULL AND m.company_id = r.company_id AND m.role = 'owner';
DELETE FROM currency_rates WHERE set_by IS NULL;
ALTER TABLE currency_rates
    DROP COLUMN source,
    ALTER COLUMN set_by SET NOT NULL;
ALTER TABLE companies
    DROP COLUMN rate_rounding,
    DROP COLUMN rate_source;
