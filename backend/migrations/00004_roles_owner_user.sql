-- +goose Up
-- Roles are owner and user: the admin panel sets a company's owner, the
-- owner adds users from the app.
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
-- Each company keeps its first owner; every other member (the old manager
-- and staff, and the owners added later) becomes a user.
UPDATE user_companies uc SET role = 'user'
WHERE uc.role <> 'owner' OR uc.user_phone <> (
    SELECT o.user_phone FROM user_companies o
    WHERE o.company_id = uc.company_id AND o.role = 'owner'
    ORDER BY o.created_at, o.user_phone LIMIT 1);
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'user'));
-- A company has one owner.
CREATE UNIQUE INDEX user_companies_one_owner ON user_companies (company_id) WHERE role = 'owner';

-- +goose Down
DROP INDEX user_companies_one_owner;
ALTER TABLE user_companies DROP CONSTRAINT user_companies_role_check;
ALTER TABLE user_companies ALTER COLUMN role SET DEFAULT 'owner';
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_check CHECK (role IN ('owner', 'manager', 'staff'));
