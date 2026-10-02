-- +goose Up
-- The company a refresh token was issued for, so a refreshed access token
-- keeps the company the user chose (switch-company). NULL: none chosen.
ALTER TABLE refresh_tokens ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE refresh_tokens DROP COLUMN company_id;
