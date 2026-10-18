-- +goose Up
-- The tasks are the orders («Buyurtmalar», logic/orders.md): their tables
-- and everything named after them take the orders' names. What they hold
-- stays as it is.
ALTER TABLE task_stages RENAME TO order_stages;
ALTER TABLE task_types RENAME TO order_types;
ALTER TABLE task_fields RENAME TO order_fields;
ALTER TABLE tasks RENAME TO orders;
ALTER TABLE task_values RENAME TO order_values;
ALTER TABLE task_history RENAME TO order_history;
ALTER TABLE order_values RENAME COLUMN task_id TO order_id;
ALTER TABLE order_history RENAME COLUMN task_id TO order_id;

ALTER SEQUENCE task_stages_id_seq RENAME TO order_stages_id_seq;
ALTER SEQUENCE task_types_id_seq RENAME TO order_types_id_seq;
ALTER SEQUENCE task_fields_id_seq RENAME TO order_fields_id_seq;
ALTER SEQUENCE tasks_id_seq RENAME TO orders_id_seq;
ALTER SEQUENCE task_history_id_seq RENAME TO order_history_id_seq;

-- The constraints; a primary key's or a unique constraint's index takes the
-- new name with it.
ALTER TABLE order_stages RENAME CONSTRAINT task_stages_pkey TO order_stages_pkey;
ALTER TABLE order_stages RENAME CONSTRAINT task_stages_company_id_id_key TO order_stages_company_id_id_key;
ALTER TABLE order_stages RENAME CONSTRAINT task_stages_company_id_fkey TO order_stages_company_id_fkey;
ALTER TABLE order_stages RENAME CONSTRAINT task_stages_color_check TO order_stages_color_check;
ALTER TABLE order_types RENAME CONSTRAINT task_types_pkey TO order_types_pkey;
ALTER TABLE order_types RENAME CONSTRAINT task_types_company_id_id_key TO order_types_company_id_id_key;
ALTER TABLE order_types RENAME CONSTRAINT task_types_company_id_fkey TO order_types_company_id_fkey;
ALTER TABLE order_fields RENAME CONSTRAINT task_fields_pkey TO order_fields_pkey;
ALTER TABLE order_fields RENAME CONSTRAINT task_fields_company_id_type_id_fkey TO order_fields_company_id_type_id_fkey;
ALTER TABLE order_fields RENAME CONSTRAINT task_fields_company_id_dropdown_id_fkey TO order_fields_company_id_dropdown_id_fkey;
ALTER TABLE order_fields RENAME CONSTRAINT task_fields_kind_check TO order_fields_kind_check;
ALTER TABLE order_fields RENAME CONSTRAINT task_fields_check TO order_fields_check;
ALTER TABLE orders RENAME CONSTRAINT tasks_pkey TO orders_pkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_company_id_fkey TO orders_company_id_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_company_id_type_id_fkey TO orders_company_id_type_id_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_company_id_stage_id_fkey TO orders_company_id_stage_id_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_company_id_customer_id_fkey TO orders_company_id_customer_id_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_assignee_phone_fkey TO orders_assignee_phone_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_created_by_fkey TO orders_created_by_fkey;
ALTER TABLE orders RENAME CONSTRAINT tasks_location_fk TO orders_location_fk;
ALTER TABLE order_values RENAME CONSTRAINT task_values_task_id_fkey TO order_values_order_id_fkey;
ALTER TABLE order_values RENAME CONSTRAINT task_values_field_id_fkey TO order_values_field_id_fkey;
ALTER TABLE order_values RENAME CONSTRAINT task_values_option_id_fkey TO order_values_option_id_fkey;
ALTER TABLE order_values RENAME CONSTRAINT task_values_check TO order_values_check;
ALTER TABLE order_history RENAME CONSTRAINT task_history_pkey TO order_history_pkey;
ALTER TABLE order_history RENAME CONSTRAINT task_history_task_id_fkey TO order_history_order_id_fkey;
ALTER TABLE order_history RENAME CONSTRAINT task_history_actor_phone_fkey TO order_history_actor_phone_fkey;
ALTER TABLE order_history RENAME CONSTRAINT task_history_action_check TO order_history_action_check;

-- The other indexes.
ALTER INDEX task_stages_name RENAME TO order_stages_name;
ALTER INDEX task_types_name RENAME TO order_types_name;
ALTER INDEX task_fields_label RENAME TO order_fields_label;
ALTER INDEX task_fields_dropdown RENAME TO order_fields_dropdown;
ALTER INDEX tasks_due RENAME TO orders_due;
ALTER INDEX tasks_stage RENAME TO orders_stage;
ALTER INDEX tasks_type RENAME TO orders_type;
ALTER INDEX tasks_customer RENAME TO orders_customer;
ALTER INDEX tasks_assignee RENAME TO orders_assignee;
ALTER INDEX tasks_location RENAME TO orders_location;
ALTER INDEX task_values_scalar RENAME TO order_values_scalar;
ALTER INDEX task_values_option RENAME TO order_values_option;
ALTER INDEX task_values_field RENAME TO order_values_field;
ALTER INDEX task_values_option_id RENAME TO order_values_option_id;
ALTER INDEX task_history_task RENAME TO order_history_order;

-- +goose Down
ALTER TABLE order_stages RENAME TO task_stages;
ALTER TABLE order_types RENAME TO task_types;
ALTER TABLE order_fields RENAME TO task_fields;
ALTER TABLE orders RENAME TO tasks;
ALTER TABLE order_values RENAME TO task_values;
ALTER TABLE order_history RENAME TO task_history;
ALTER TABLE task_values RENAME COLUMN order_id TO task_id;
ALTER TABLE task_history RENAME COLUMN order_id TO task_id;

ALTER SEQUENCE order_stages_id_seq RENAME TO task_stages_id_seq;
ALTER SEQUENCE order_types_id_seq RENAME TO task_types_id_seq;
ALTER SEQUENCE order_fields_id_seq RENAME TO task_fields_id_seq;
ALTER SEQUENCE orders_id_seq RENAME TO tasks_id_seq;
ALTER SEQUENCE order_history_id_seq RENAME TO task_history_id_seq;

ALTER TABLE task_stages RENAME CONSTRAINT order_stages_pkey TO task_stages_pkey;
ALTER TABLE task_stages RENAME CONSTRAINT order_stages_company_id_id_key TO task_stages_company_id_id_key;
ALTER TABLE task_stages RENAME CONSTRAINT order_stages_company_id_fkey TO task_stages_company_id_fkey;
ALTER TABLE task_stages RENAME CONSTRAINT order_stages_color_check TO task_stages_color_check;
ALTER TABLE task_types RENAME CONSTRAINT order_types_pkey TO task_types_pkey;
ALTER TABLE task_types RENAME CONSTRAINT order_types_company_id_id_key TO task_types_company_id_id_key;
ALTER TABLE task_types RENAME CONSTRAINT order_types_company_id_fkey TO task_types_company_id_fkey;
ALTER TABLE task_fields RENAME CONSTRAINT order_fields_pkey TO task_fields_pkey;
ALTER TABLE task_fields RENAME CONSTRAINT order_fields_company_id_type_id_fkey TO task_fields_company_id_type_id_fkey;
ALTER TABLE task_fields RENAME CONSTRAINT order_fields_company_id_dropdown_id_fkey TO task_fields_company_id_dropdown_id_fkey;
ALTER TABLE task_fields RENAME CONSTRAINT order_fields_kind_check TO task_fields_kind_check;
ALTER TABLE task_fields RENAME CONSTRAINT order_fields_check TO task_fields_check;
ALTER TABLE tasks RENAME CONSTRAINT orders_pkey TO tasks_pkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_company_id_fkey TO tasks_company_id_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_company_id_type_id_fkey TO tasks_company_id_type_id_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_company_id_stage_id_fkey TO tasks_company_id_stage_id_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_company_id_customer_id_fkey TO tasks_company_id_customer_id_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_assignee_phone_fkey TO tasks_assignee_phone_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_created_by_fkey TO tasks_created_by_fkey;
ALTER TABLE tasks RENAME CONSTRAINT orders_location_fk TO tasks_location_fk;
ALTER TABLE task_values RENAME CONSTRAINT order_values_order_id_fkey TO task_values_task_id_fkey;
ALTER TABLE task_values RENAME CONSTRAINT order_values_field_id_fkey TO task_values_field_id_fkey;
ALTER TABLE task_values RENAME CONSTRAINT order_values_option_id_fkey TO task_values_option_id_fkey;
ALTER TABLE task_values RENAME CONSTRAINT order_values_check TO task_values_check;
ALTER TABLE task_history RENAME CONSTRAINT order_history_pkey TO task_history_pkey;
ALTER TABLE task_history RENAME CONSTRAINT order_history_order_id_fkey TO task_history_task_id_fkey;
ALTER TABLE task_history RENAME CONSTRAINT order_history_actor_phone_fkey TO task_history_actor_phone_fkey;
ALTER TABLE task_history RENAME CONSTRAINT order_history_action_check TO task_history_action_check;

ALTER INDEX order_stages_name RENAME TO task_stages_name;
ALTER INDEX order_types_name RENAME TO task_types_name;
ALTER INDEX order_fields_label RENAME TO task_fields_label;
ALTER INDEX order_fields_dropdown RENAME TO task_fields_dropdown;
ALTER INDEX orders_due RENAME TO tasks_due;
ALTER INDEX orders_stage RENAME TO tasks_stage;
ALTER INDEX orders_type RENAME TO tasks_type;
ALTER INDEX orders_customer RENAME TO tasks_customer;
ALTER INDEX orders_assignee RENAME TO tasks_assignee;
ALTER INDEX orders_location RENAME TO tasks_location;
ALTER INDEX order_values_scalar RENAME TO task_values_scalar;
ALTER INDEX order_values_option RENAME TO task_values_option;
ALTER INDEX order_values_field RENAME TO task_values_field;
ALTER INDEX order_values_option_id RENAME TO task_values_option_id;
ALTER INDEX order_history_order RENAME TO task_history_task;
