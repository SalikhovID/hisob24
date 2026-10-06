-- +goose Up
-- A task's foreign key points at a customer of its own company.
ALTER TABLE customers ADD CONSTRAINT customers_company_id_id_key UNIQUE (company_id, id);

-- A company's tasks (logic/tasks.md). A task is of one type and one customer
-- for good, stands in one stage, is due on a day, and may be assigned to a
-- member. Nothing is removed: a deleted task is hidden with deleted_at.
CREATE TABLE tasks (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    type_id         BIGINT NOT NULL,
    stage_id        BIGINT NOT NULL,
    customer_id     BIGINT NOT NULL,
    title           TEXT NOT NULL,
    deadline        DATE NOT NULL,
    -- The member the task is assigned to, and the name they went by in the
    -- company then: it is what stays when they leave the company.
    assignee_phone  TEXT REFERENCES users(phone) ON UPDATE CASCADE,
    assignee_name   TEXT,
    -- The member who entered the task, and the name they went by then.
    created_by      TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    FOREIGN KEY (company_id, type_id) REFERENCES task_types (company_id, id),
    FOREIGN KEY (company_id, stage_id) REFERENCES task_stages (company_id, id),
    FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id)
);
-- The list: the company's tasks, the one due soonest first.
CREATE INDEX tasks_due ON tasks (company_id, deadline, id) WHERE deleted_at IS NULL;
-- What is in use, and the filters of the list.
CREATE INDEX tasks_stage ON tasks (stage_id);
CREATE INDEX tasks_type ON tasks (type_id);
CREATE INDEX tasks_customer ON tasks (customer_id);
CREATE INDEX tasks_assignee ON tasks (assignee_phone) WHERE assignee_phone IS NOT NULL;

-- A task's answers to the fields of its type, as a customer's are: one row
-- for a text or a whole number, one row for each option chosen in a choice
-- field. An empty answer has no row.
CREATE TABLE task_values (
    task_id     BIGINT NOT NULL REFERENCES tasks(id),
    field_id    BIGINT NOT NULL REFERENCES task_fields(id),
    option_id   BIGINT REFERENCES customer_dropdown_options(id),
    text_value  TEXT,
    int_value   BIGINT,
    CHECK (num_nonnulls(option_id, text_value, int_value) = 1)
);
CREATE UNIQUE INDEX task_values_scalar ON task_values (task_id, field_id) WHERE option_id IS NULL;
CREATE UNIQUE INDEX task_values_option ON task_values (task_id, field_id, option_id) WHERE option_id IS NOT NULL;
CREATE INDEX task_values_field ON task_values (field_id);
CREATE INDEX task_values_option_id ON task_values (option_id) WHERE option_id IS NOT NULL;

-- What happened to a task: it was entered, edited (moved to another stage
-- too), deleted. An edit keeps each changed thing as text, under the names
-- of that time: [{"label": "Bosqich", "old": "Yangi", "new": "Jarayonda"}].
CREATE TABLE task_history (
    id          BIGSERIAL PRIMARY KEY,
    task_id     BIGINT NOT NULL REFERENCES tasks(id),
    action      TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    actor_phone TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE,
    actor_name  TEXT,
    changes     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX task_history_task ON task_history (task_id, id DESC);

-- +goose Down
DROP TABLE task_history;
DROP TABLE task_values;
DROP TABLE tasks;
ALTER TABLE customers DROP CONSTRAINT customers_company_id_id_key;
