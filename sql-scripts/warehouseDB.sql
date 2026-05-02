CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE rack_kind AS ENUM ('SHELF', 'CELL', 'FRIDGE', 'PALLET');

CREATE TABLE warehouse_read_model (
    warehouse_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL,
    name                VARCHAR(255) NOT NULL,
    address             VARCHAR(512),
    responsible_user_id UUID,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uk_warehouse_org_name UNIQUE (org_id, name)
);

CREATE INDEX idx_warehouse_read_model_org_id ON warehouse_read_model(org_id);

CREATE TABLE warehouse_events (
    event_id        BIGSERIAL PRIMARY KEY,
    warehouse_id    UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouse_events_warehouse_id ON warehouse_events(warehouse_id);

CREATE TABLE rack_read_model (
    rack_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id    UUID NOT NULL REFERENCES warehouse_read_model(warehouse_id) ON DELETE CASCADE,
    kind            rack_kind NOT NULL,
    name            VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_rack_read_model_warehouse_id ON rack_read_model(warehouse_id);

CREATE TABLE rack_events (
    event_id        BIGSERIAL PRIMARY KEY,
    rack_id         UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_rack_events_rack_id ON rack_events(rack_id);

CREATE TABLE shelf (
    shelf_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id             UUID NOT NULL REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    shelf_capacity_kg   NUMERIC(8, 2) NOT NULL,
    length_cm           NUMERIC(8, 2) NOT NULL,
    width_cm            NUMERIC(8, 2) NOT NULL,
    height_cm           NUMERIC(8, 2) NOT NULL,
    CONSTRAINT chk_shelf_capacity CHECK (shelf_capacity_kg > 0),
    CONSTRAINT chk_shelf_dims CHECK (length_cm > 0 AND width_cm > 0 AND height_cm > 0)
);

CREATE TABLE cell (
    cell_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id         UUID NOT NULL REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    max_weight_kg   NUMERIC(8, 2),
    length_cm       NUMERIC(8, 2) NOT NULL,
    width_cm        NUMERIC(8, 2) NOT NULL,
    height_cm       NUMERIC(8, 2) NOT NULL,
    CONSTRAINT chk_cell_weight CHECK (max_weight_kg IS NULL OR max_weight_kg > 0),
    CONSTRAINT chk_cell_dims CHECK (length_cm > 0 AND width_cm > 0 AND height_cm > 0)
);

CREATE TABLE fridge (
    rack_id             UUID PRIMARY KEY REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    temperature_c       NUMERIC(5, 2),
    length_cm           NUMERIC(8, 2) NOT NULL,
    width_cm            NUMERIC(8, 2) NOT NULL,
    height_cm           NUMERIC(8, 2) NOT NULL,
    CONSTRAINT chk_fridge_dims CHECK (length_cm > 0 AND width_cm > 0 AND height_cm > 0)
);

CREATE TABLE pallet (
    rack_id             UUID PRIMARY KEY REFERENCES rack_read_model(rack_id) ON DELETE CASCADE,
    pallet_place_count  INT NOT NULL,
    max_weight_kg       NUMERIC(8, 2) NOT NULL,
    CONSTRAINT chk_pallet_places CHECK (pallet_place_count > 0),
    CONSTRAINT chk_pallet_weight CHECK (max_weight_kg > 0)
);

CREATE TABLE pallet_place (
    place_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rack_id         UUID NOT NULL REFERENCES pallet(rack_id) ON DELETE CASCADE,
    length_cm       NUMERIC(8, 2) NOT NULL,
    width_cm        NUMERIC(8, 2) NOT NULL,
    height_cm       NUMERIC(8, 2) NOT NULL
);
