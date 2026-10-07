-- +goose Up
-- A member's own order of the app's sections in the company (logic/roles.md,
-- section 8): the section keys as the app knows them; NULL is the default
-- order. It goes with the membership.
ALTER TABLE user_companies ADD COLUMN nav_order TEXT[];

-- +goose Down
ALTER TABLE user_companies DROP COLUMN nav_order;
