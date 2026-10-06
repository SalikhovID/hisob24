-- +goose Up
-- A company role is a name and a set of permissions ("customers.view" and
-- the like, the catalog is internal/access) the company's owner makes and
-- gives to employees. A role nobody holds is removed for good: nothing
-- refers to it, so its name is free again at once.
CREATE TABLE roles (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL REFERENCES companies(id),
    name         TEXT NOT NULL,
    permissions  TEXT[] NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- What a membership's foreign key points at: a member's role is the
    -- member's company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX roles_name ON roles (company_id, lower(name));

-- A user with no role keeps the default permissions; the owner has every
-- permission and no role. A role someone holds is not deleted (RESTRICT).
ALTER TABLE user_companies ADD COLUMN role_id BIGINT;
ALTER TABLE user_companies ADD CONSTRAINT user_companies_role_fk
    FOREIGN KEY (company_id, role_id) REFERENCES roles (company_id, id);
ALTER TABLE user_companies ADD CONSTRAINT user_companies_owner_has_no_role
    CHECK (role <> 'owner' OR role_id IS NULL);
CREATE INDEX user_companies_role_id ON user_companies (role_id);

-- +goose Down
-- The foreign key and the check go with the column.
ALTER TABLE user_companies DROP COLUMN role_id;
DROP TABLE roles;
