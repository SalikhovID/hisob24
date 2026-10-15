-- +goose Up
-- The member's own pages of the tab bar in the company (logic/roles.md,
-- section 8): up to four page keys as the app knows them, in their order;
-- NULL is the default bar. It goes with the membership. It takes the place
-- of the order of the menu: the sidebar keeps the default order, and the
-- orders kept so far go.
ALTER TABLE user_companies ADD COLUMN tab_bar TEXT[];
ALTER TABLE user_companies DROP COLUMN nav_order;

-- +goose Down
ALTER TABLE user_companies ADD COLUMN nav_order TEXT[];
ALTER TABLE user_companies DROP COLUMN tab_bar;
