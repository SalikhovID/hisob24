-- +goose Up
-- Roles are owner and user: the admin panel sets a company's owner, the
-- owner adds users from the app. The old manager and staff become users.
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
UPDATE user_companies SET role = 'user' WHERE role IN ('manager', 'staff');
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'user'));

-- +goose Down
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'owner';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'manager', 'staff'));
