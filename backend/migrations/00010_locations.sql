-- +goose Up
-- A company's locations (its branches, logic/locations.md): a task stands in
-- one, a member works in one at a time. Nothing here is ever removed:
-- deleted_at hides a location, and its name is free again.
CREATE TABLE locations (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    -- What a task's and a restriction's foreign keys point at: a task and
    -- its location are one company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX locations_name ON locations (company_id, lower(name)) WHERE deleted_at IS NULL;

-- Every company starts with one location, "Asosiy", which the admin may
-- rename. The companies there are get it here; a new one gets it when it is
-- created (SeedLocation).
INSERT INTO locations (company_id, name) SELECT id, 'Asosiy' FROM companies;

-- A task stands in a location of its company. The tasks there are stand in
-- their company's ready location.
ALTER TABLE tasks ADD COLUMN location_id BIGINT;
UPDATE tasks t SET location_id = l.id FROM locations l WHERE l.company_id = t.company_id;
ALTER TABLE tasks ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_location_fk FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id);
CREATE INDEX tasks_location ON tasks (location_id);

-- A member may work in every location of the company unless the owner
-- restricts them to some (member_locations). The owner is never restricted
-- (CHECK, as the owner holds no role).
ALTER TABLE user_companies ADD COLUMN all_locations BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_companies ADD CONSTRAINT user_companies_owner_has_all_locations CHECK (role <> 'owner' OR all_locations);
CREATE TABLE member_locations (
    user_phone   TEXT NOT NULL,
    company_id   BIGINT NOT NULL,
    location_id  BIGINT NOT NULL,
    PRIMARY KEY (user_phone, company_id, location_id),
    -- The restriction is a membership's and goes with it.
    FOREIGN KEY (user_phone, company_id) REFERENCES user_companies (user_phone, company_id) ON UPDATE CASCADE ON DELETE CASCADE,
    -- A member is restricted to locations of their own company.
    FOREIGN KEY (company_id, location_id) REFERENCES locations (company_id, id)
);
CREATE INDEX member_locations_location ON member_locations (location_id);

-- +goose Down
DROP TABLE member_locations;
-- The check goes with the column.
ALTER TABLE user_companies DROP COLUMN all_locations;
-- The foreign key and the index go with the column.
ALTER TABLE tasks DROP COLUMN location_id;
DROP TABLE locations;
