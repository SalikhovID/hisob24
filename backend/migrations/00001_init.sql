-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admins (
    telegram_id BIGINT PRIMARY KEY,
    full_name   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO admins (telegram_id, full_name) VALUES (461603558, 'Owner');

CREATE TABLE admin_login_codes (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    BIGINT NOT NULL REFERENCES admins(telegram_id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX admin_login_codes_active ON admin_login_codes(code_hash) WHERE used_at IS NULL;

CREATE TABLE admin_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    BIGINT NOT NULL REFERENCES admins(telegram_id) ON DELETE CASCADE,
    source      TEXT NOT NULL CHECK (source IN ('otp','miniapp')),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    end_date    DATE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  BIGINT REFERENCES admins(telegram_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    phone       TEXT PRIMARY KEY CHECK (phone ~ '^[0-9]{9,15}$'),
    full_name   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_companies (
    user_phone  TEXT   NOT NULL REFERENCES users(phone) ON UPDATE CASCADE ON DELETE CASCADE,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role        TEXT   NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager','staff')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_phone, company_id)
);

CREATE TABLE billings (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL REFERENCES companies(id),
    days           INT NOT NULL CHECK (days > 0),
    amount         NUMERIC(14,2),
    prev_end_date  DATE NOT NULL,
    new_end_date   DATE NOT NULL,
    note           TEXT,
    created_by     BIGINT REFERENCES admins(telegram_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sms_codes (
    phone       TEXT PRIMARY KEY,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_phone  TEXT NOT NULL REFERENCES users(phone) ON UPDATE CASCADE ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);

-- users jadvaliga FK ataylab qo'yilmagan: tizimda yo'q raqamlar ham shu yerda saqlanishi kerak
CREATE TABLE telegram_contacts (
    chat_id     BIGINT PRIMARY KEY,
    phone       TEXT NOT NULL,
    username    TEXT,
    first_name  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX telegram_contacts_phone ON telegram_contacts(phone);

-- +goose Down
-- pgcrypto stays: other objects in the database may use it.
DROP TABLE telegram_contacts;
DROP TABLE refresh_tokens;
DROP TABLE sms_codes;
DROP TABLE billings;
DROP TABLE user_companies;
DROP TABLE users;
DROP TABLE companies;
DROP TABLE admin_sessions;
DROP TABLE admin_login_codes;
DROP TABLE admins;
