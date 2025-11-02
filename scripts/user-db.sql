CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('WORKER', 'ACCOUNTANT', 'DIRECTOR');
CREATE TYPE auth_provider AS ENUM ('LOCAL', 'GOOGLE', 'YANDEX');

CREATE TABLE user_events (
    event_id        SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE user_read_model (
    user_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    roles           user_role NOT NULL,
    password_hash   VARCHAR(255),
    provider        auth_provider NOT NULL,
    provider_uid    VARCHAR(128),
    photo           BYTEA,
     organization_id UUID,
     warehouse_id    UUID,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE user_login_audit (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    login_time      TIMESTAMP NOT NULL DEFAULT now(),
    ip_address      INET,
    user_agent      VARCHAR(512),
    provider        auth_provider NOT NULL
);