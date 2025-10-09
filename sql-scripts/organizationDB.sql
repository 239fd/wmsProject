CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE org_status AS ENUM ('ACTIVE', 'BLOCKED', 'ARCHIVED');

CREATE TABLE organization_read_model (
    org_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL UNIQUE,
    short_name      VARCHAR(100),
    unp             VARCHAR(20) NOT NULL UNIQUE,
    address         VARCHAR(512),
    status          org_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE organization_events (
    event_id        SERIAL PRIMARY KEY,
    org_id          UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
