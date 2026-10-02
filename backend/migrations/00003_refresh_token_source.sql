-- +goose Up
-- Where a refresh token's session began: the SMS code in a browser, or the
-- user Mini App, whose cookie must also work inside Telegram Web's iframe.
ALTER TABLE refresh_tokens ADD COLUMN source TEXT NOT NULL DEFAULT 'sms' CHECK (source IN ('sms', 'telegram'));

-- +goose Down
ALTER TABLE refresh_tokens DROP COLUMN source;
