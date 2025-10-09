CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE rack_kind AS ENUM ('SHELF', 'CELL', 'FRIDGE', 'PALLET', 'FREEZER');

CREATE TABLE product_category (
    category_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT
);

CREATE TABLE category_rack_kind (
    category_id UUID NOT NULL REFERENCES product_category(category_id),
    rack_kind   rack_kind NOT NULL,
    PRIMARY KEY (category_id, rack_kind)
);

CREATE TABLE supplier (
    supplier_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255) NOT NULL,
    inn           VARCHAR(20),
    address       TEXT
);

CREATE TABLE product (
    product_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku           VARCHAR(64) NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    category_id   UUID NOT NULL REFERENCES product_category(category_id),
    unit          VARCHAR(16) NOT NULL,
    shelf_life_days INTEGER,
    barcode       VARCHAR(64)
);

CREATE TABLE delivery (
    delivery_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID NOT NULL REFERENCES supplier(supplier_id),
    delivery_number VARCHAR(64) NOT NULL,
    delivery_date   DATE NOT NULL,
    accepted_by     UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE delivery_item (
    delivery_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id      UUID NOT NULL REFERENCES delivery(delivery_id),
    product_id       UUID NOT NULL REFERENCES product(product_id),
    planned_quantity NUMERIC(12,3) NOT NULL,
    price_per_unit   NUMERIC(12,2)
);

CREATE TABLE batch (
    batch_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_item_id UUID NOT NULL REFERENCES delivery_item(delivery_item_id),
    batch_number    VARCHAR(64),
    quantity        NUMERIC(12,3) NOT NULL,
    production_date DATE,
    expiry_date     DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE stock (
    stock_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id       UUID NOT NULL REFERENCES batch(batch_id),
    warehouse_id   UUID NOT NULL,
    rack_id        UUID NOT NULL,
    place_id       UUID,
    quantity       NUMERIC(12,3) NOT NULL,
    reserved       NUMERIC(12,3) NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE stock_event (
    event_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type       VARCHAR(32) NOT NULL,
    batch_id         UUID NOT NULL REFERENCES batch(batch_id),
    from_warehouse_id UUID,
    from_rack_id     UUID,
    from_place_id    UUID,
    to_warehouse_id  UUID,
    to_rack_id       UUID,
    to_place_id      UUID,
    quantity         NUMERIC(12,3),
    user_id          UUID,
    event_time       TIMESTAMP NOT NULL DEFAULT now(),
    document_number  VARCHAR(64),
    comment          TEXT,
    price_before     NUMERIC(12,2),
    price_after      NUMERIC(12,2)
);

CREATE TABLE shipment_request (
    shipment_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by      UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    status          VARCHAR(16) NOT NULL,
    comment         TEXT
);

CREATE TABLE shipment_item (
    shipment_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id      UUID NOT NULL REFERENCES shipment_request(shipment_id),
    product_id       UUID NOT NULL REFERENCES product(product_id),
    batch_id         UUID REFERENCES batch(batch_id),
    planned_quantity NUMERIC(12,3) NOT NULL,
    actual_quantity  NUMERIC(12,3),
    comment          TEXT
);

CREATE TABLE inventory_session (
    session_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id   UUID NOT NULL,
    started_by     UUID,
    started_at     TIMESTAMP NOT NULL DEFAULT now(),
    ended_at       TIMESTAMP,
    status         VARCHAR(16) NOT NULL
);

CREATE TABLE inventory_item (
    inventory_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id        UUID NOT NULL REFERENCES inventory_session(session_id),
    product_id        UUID NOT NULL REFERENCES product(product_id),
    batch_id          UUID REFERENCES batch(batch_id),
    warehouse_id      UUID NOT NULL,
    rack_id           UUID,
    place_id          UUID,
    counted_quantity  NUMERIC(12,3) NOT NULL,
    scanned_by        UUID,
    scanned_at        TIMESTAMP NOT NULL DEFAULT now()
);