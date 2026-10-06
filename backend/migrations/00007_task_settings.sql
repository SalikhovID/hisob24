-- +goose Up
-- A stage is a column of the tasks' board: the state a task is in (Yangi,
-- Jarayonda, Bajarildi). position orders the company's stages; a stage that
-- is done holds finished tasks, which are never overdue. Nothing here is
-- ever removed: deleted_at hides a row, and its name is free again.
CREATE TABLE task_stages (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    color       TEXT NOT NULL CHECK (color IN ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink')),
    is_done     BOOLEAN NOT NULL DEFAULT false,
    position    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    -- What a task's foreign key points at: a task and its stage are one
    -- company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX task_stages_name ON task_stages (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A task type (Buyurtma, Shikoyat) decides what a task's form asks beside
-- the title, the deadline, the customer and the assignee every task has.
-- position orders the company's types.
CREATE TABLE task_types (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id),
    name        TEXT NOT NULL,
    position    INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    -- What a field's and a task's foreign keys point at: they are the
    -- type's company's.
    UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX task_types_name ON task_types (company_id, lower(name)) WHERE deleted_at IS NULL;

-- A field is one question of a task type, as a customer field is of a
-- customer type; a task field is never told not to repeat. The choice kinds
-- take their options from the company's dropdowns, the same ones the
-- customer fields use.
CREATE TABLE task_fields (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL,
    type_id      BIGINT NOT NULL,
    label        TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('string', 'int', 'dropdown', 'multi_dropdown', 'radio', 'checkbox')),
    dropdown_id  BIGINT,
    required     BOOLEAN NOT NULL DEFAULT false,
    position     INT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES task_types (company_id, id),
    FOREIGN KEY (company_id, dropdown_id) REFERENCES customer_dropdowns (company_id, id),
    CHECK ((kind IN ('string', 'int')) = (dropdown_id IS NULL))
);
CREATE UNIQUE INDEX task_fields_label ON task_fields (type_id, lower(label)) WHERE deleted_at IS NULL;
-- What is in use: the fields that take their options from a dropdown.
CREATE INDEX task_fields_dropdown ON task_fields (dropdown_id) WHERE dropdown_id IS NOT NULL;

-- Every company starts with three stages and one type, which its owner may
-- change (logic/tasks.md, 3.4). The companies there are get them here; a new
-- one gets them when it is created (SeedTaskSettings).
INSERT INTO task_stages (company_id, name, color, is_done, position)
SELECT id, 'Yangi', 'blue', false, 1 FROM companies
UNION ALL
SELECT id, 'Jarayonda', 'amber', false, 2 FROM companies
UNION ALL
SELECT id, 'Bajarildi', 'green', true, 3 FROM companies;
INSERT INTO task_types (company_id, name, position)
SELECT id, 'Vazifa', 1 FROM companies;

-- +goose Down
DROP TABLE task_fields;
DROP TABLE task_types;
DROP TABLE task_stages;
