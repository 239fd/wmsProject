CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE rack_kind AS ENUM ('SHELF', 'CELL', 'FRIDGE');

CREATE TABLE warehouse_read_model (
    warehouse_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    address         VARCHAR(512),
    responsible_user_id UUID,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_events (
    event_id        SERIAL PRIMARY KEY,
    warehouse_id    UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE rack_read_model (
    rack_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id    UUID NOT NULL REFERENCES warehouse_read_model(warehouse_id) ON DELETE CASCADE,
    kind            rack_kind NOT NULL,
    name            VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE rack_events (
    event_id        SERIAL PRIMARY KEY,
    rack_id         UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE shelf (
    shelf_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id             UUID NOT NULL REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    shelf_capacity_kg   NUMERIC(8, 2) NOT NULL,
    length_cm           NUMERIC(8,2) NOT NULL,
    width_cm            NUMERIC(8,2) NOT NULL,
    height_cm           NUMERIC(8,2) NOT NULL
);

CREATE TABLE cell (
    cell_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id         UUID NOT NULL REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    max_weight_kg   NUMERIC(8, 2),
    length_cm       NUMERIC(8,2) NOT NULL,
    width_cm        NUMERIC(8,2) NOT NULL,
    height_cm       NUMERIC(8,2) NOT NULL
);

CREATE TABLE fridge (
    rack_id             UUID PRIMARY KEY REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    temperature_c       NUMERIC(5,2),
    length_cm           NUMERIC(8,2) NOT NULL,
    width_cm            NUMERIC(8,2) NOT NULL,
    height_cm           NUMERIC(8,2) NOT NULL
);

CREATE TABLE pallet (
    rack_id             UUID PRIMARY KEY REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    pallet_place_count  INT NOT NULL,
    max_weight_kg       NUMERIC(8,2) NOT NULL
);

CREATE TABLE pallet_place (
    place_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id         UUID NOT NULL REFERENCES pallet(rack_id) ON DELETE CASCADE,
    length_cm       NUMERIC(8,2) NOT NULL,
    width_cm        NUMERIC(8,2) NOT NULL,
    height_cm       NUMERIC(8,2) NOT NULL
);
