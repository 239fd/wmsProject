CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE product_read_model (
    product_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(100) UNIQUE,
    barcode         VARCHAR(100),
    category        VARCHAR(100),
    description     TEXT,
    unit_of_measure VARCHAR(50),
    weight_kg       NUMERIC(10, 2),
    volume_m3       NUMERIC(10, 3),
    price           NUMERIC(12, 2),
    abc_class       VARCHAR(255) NOT NULL DEFAULT 'C',
    required_storage_condition VARCHAR(20) CHECK (required_storage_condition IS NULL OR required_storage_condition IN ('ROOM', 'COOL', 'FRIDGE', 'FREEZER')),
    organization_id UUID,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_org_id ON product_read_model(organization_id);

CREATE INDEX idx_product_read_model_sku ON product_read_model(sku);
CREATE INDEX idx_product_read_model_barcode ON product_read_model(barcode);
CREATE INDEX idx_product_read_model_category ON product_read_model(category);

CREATE TABLE product_events (
    event_id        BIGSERIAL PRIMARY KEY,
    product_id      UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_events_product_id ON product_events(product_id);

CREATE TABLE inventory_events (
    event_id        BIGSERIAL PRIMARY KEY,
    inventory_id    UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_events_inventory_id ON inventory_events(inventory_id);
CREATE INDEX idx_inventory_events_created_at ON inventory_events(created_at);

CREATE TABLE product_batch (
    batch_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id         UUID NOT NULL,
    organization_id    UUID,
    supply_id          UUID,
    batch_number       VARCHAR(100),
    manufacture_date   DATE,
    expiry_date        DATE,
    supplier           VARCHAR(255),
    purchase_price     NUMERIC(12, 2),
    storage_conditions VARCHAR(20) CHECK (storage_conditions IS NULL OR storage_conditions IN ('ROOM', 'COOL', 'FRIDGE', 'FREEZER')),
    packaging_type     VARCHAR(10) CHECK (packaging_type IS NULL OR packaging_type IN ('PALLET', 'BOX', 'CRATE', 'EACH')),
    units_per_package  INT,
    package_length_cm  NUMERIC(8, 2),
    package_width_cm   NUMERIC(8, 2),
    package_height_cm  NUMERIC(8, 2),
    package_weight_kg  NUMERIC(10, 3),
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_batch_product_id ON product_batch(product_id);
CREATE INDEX idx_product_batch_organization_id ON product_batch(organization_id);
CREATE INDEX idx_product_batch_supply_id ON product_batch(supply_id);
CREATE INDEX idx_product_batch_expiry_date ON product_batch(expiry_date);

CREATE TABLE inventory (
    inventory_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id        UUID NOT NULL,
    batch_id          UUID,
    organization_id   UUID,
    warehouse_id      UUID NOT NULL,
    cell_id           UUID,
    unit_sku          VARCHAR(20),
    quantity          NUMERIC(12, 3) NOT NULL,
    reserved_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    status            VARCHAR NOT NULL,
    last_updated      TIMESTAMP NOT NULL DEFAULT now(),
    version           BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_inventory_product_batch_warehouse_cell UNIQUE (product_id, batch_id, warehouse_id, cell_id)
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_organization_id ON inventory(organization_id);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_inventory_cell_id ON inventory(cell_id);
CREATE INDEX idx_inventory_unit_sku ON inventory(unit_sku);

CREATE TABLE inventory_session (
    session_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID,
    warehouse_id         UUID NOT NULL,
    started_by           UUID NOT NULL,
    responsible_user_id  UUID,
    reason               VARCHAR(255),
    commission_members   JSONB,
    started_at           TIMESTAMP NOT NULL DEFAULT now(),
    completed_at         TIMESTAMP,
    status               VARCHAR(50) NOT NULL,
    notes                VARCHAR(255)
);

CREATE INDEX idx_inventory_session_organization_id ON inventory_session(organization_id);
CREATE INDEX idx_inventory_session_warehouse_id ON inventory_session(warehouse_id);
CREATE INDEX idx_inventory_session_status ON inventory_session(status);

CREATE TABLE inventory_count (
    count_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id           UUID NOT NULL REFERENCES inventory_session(session_id) ON DELETE CASCADE,
    organization_id      UUID,
    product_id           UUID NOT NULL,
    batch_id             UUID,
    cell_id              UUID,
    warehouse_id         UUID NOT NULL,
    expected_quantity    NUMERIC(12, 3) NOT NULL,
    actual_quantity      NUMERIC(12, 3),
    discrepancy          NUMERIC(12, 3),
    marked_for_writeoff  BOOLEAN NOT NULL DEFAULT FALSE,
    notes                VARCHAR(255)
);

CREATE INDEX idx_inventory_count_session_id ON inventory_count(session_id);
CREATE INDEX idx_inventory_count_organization_id ON inventory_count(organization_id);
CREATE INDEX idx_inventory_count_marked_for_writeoff ON inventory_count(marked_for_writeoff);

CREATE TABLE product_operation (
    operation_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type  VARCHAR NOT NULL,
    product_id      UUID NOT NULL,
    batch_id        UUID,
    organization_id UUID,
    warehouse_id    UUID NOT NULL,
    from_cell_id    UUID,
    to_cell_id      UUID,
    quantity        NUMERIC(12, 3) NOT NULL,
    user_id         UUID NOT NULL,
    document_id     UUID,
    supply_id       UUID,
    session_id      UUID,
    status          VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    operation_date  TIMESTAMP NOT NULL DEFAULT now(),
    notes           TEXT
);

CREATE INDEX idx_product_operation_product_id ON product_operation(product_id);
CREATE INDEX idx_product_operation_organization_id ON product_operation(organization_id);
CREATE INDEX idx_product_operation_warehouse_id ON product_operation(warehouse_id);
CREATE INDEX idx_product_operation_operation_date ON product_operation(operation_date);
CREATE INDEX idx_product_operation_status ON product_operation(status);
CREATE INDEX idx_product_operation_session ON product_operation(session_id);

CREATE TABLE receipt_session (
    session_id              UUID PRIMARY KEY,
    organization_id         UUID NOT NULL,
    warehouse_id            UUID NOT NULL,
    supplier_id             UUID,
    supply_id               UUID,
    status                  VARCHAR(32) NOT NULL DEFAULT 'PAUSED',
    receipt_order_doc_id    UUID,
    receipt_act_doc_id      UUID,
    placement_list_doc_id   UUID,
    general_notes           TEXT,
    created_by              UUID NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    completed_at            TIMESTAMP
);

CREATE INDEX idx_receipt_session_org_status ON receipt_session(organization_id, status);
CREATE INDEX idx_receipt_session_warehouse ON receipt_session(warehouse_id);

CREATE TABLE product_operation_events (
    event_id        BIGSERIAL PRIMARY KEY,
    operation_id    UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_events_operation_id ON product_operation_events(operation_id);
CREATE INDEX idx_operation_events_created_at ON product_operation_events(created_at);

CREATE TABLE suppliers (
    supplier_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    name            VARCHAR(255) NOT NULL,
    unp             VARCHAR(20),
    contact_person  VARCHAR(255),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    address         VARCHAR(512),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_organization_id ON suppliers(organization_id);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_unp ON suppliers(unp);

CREATE TYPE supply_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE supplies (
    supply_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    supplier_id     UUID REFERENCES suppliers(supplier_id),
    supplier_name   VARCHAR(255),
    warehouse_id    UUID NOT NULL,
    status          supply_status NOT NULL DEFAULT 'PLANNED',
    external_id     VARCHAR(100),
    source          VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    quantity_only   BOOLEAN NOT NULL DEFAULT FALSE,
    expected_date   DATE,
    actual_date     DATE,
    total_items     INT NOT NULL DEFAULT 0,
    currency        VARCHAR(8),
    total_amount    NUMERIC(14, 2),
    snapshot        JSONB,
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_supplies_org_external UNIQUE (organization_id, external_id)
);

CREATE INDEX idx_supplies_organization_id ON supplies(organization_id);
CREATE INDEX idx_supplies_supplier_id ON supplies(supplier_id);
CREATE INDEX idx_supplies_warehouse_id ON supplies(warehouse_id);
CREATE INDEX idx_supplies_status ON supplies(status);
CREATE INDEX idx_supplies_external_id ON supplies(external_id);

CREATE TYPE saga_type AS ENUM ('RECEIVE', 'SHIP');
CREATE TYPE saga_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED');

CREATE TABLE saga_state (
    saga_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saga_type       saga_type NOT NULL,
    status          saga_status NOT NULL DEFAULT 'PENDING',
    current_step    VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL,
    failure_reason  TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_saga_state_type ON saga_state(saga_type);
CREATE INDEX idx_saga_state_status ON saga_state(status);
CREATE INDEX idx_saga_state_created_at ON saga_state(created_at);

CREATE INDEX idx_supplies_expected_date ON supplies(expected_date);

CREATE TABLE supply_items (
    item_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_id            UUID NOT NULL REFERENCES supplies(supply_id) ON DELETE CASCADE,
    product_id           UUID,
    row_number           INT,
    product_name         VARCHAR(255),
    sku                  VARCHAR(100),
    barcode              VARCHAR(100),
    category             VARCHAR(100),
    unit_of_measure      VARCHAR(50),
    manufacturer         VARCHAR(255),
    storage_conditions   VARCHAR(20) CHECK (storage_conditions IS NULL OR storage_conditions IN ('ROOM', 'COOL', 'FRIDGE', 'FREEZER')),
    expected_qty         NUMERIC(12, 3) NOT NULL,
    actual_qty           NUMERIC(12, 3),
    unit_price           NUMERIC(12, 2),
    vat_rate             NUMERIC(5, 2),
    vat_amount           NUMERIC(12, 2),
    total_amount         NUMERIC(14, 2),
    packaging_type       VARCHAR(10) CHECK (packaging_type IS NULL OR packaging_type IN ('PALLET', 'BOX', 'CRATE', 'EACH')),
    units_per_package    INT,
    package_length_cm    NUMERIC(8, 2),
    package_width_cm     NUMERIC(8, 2),
    package_height_cm    NUMERIC(8, 2),
    package_weight_kg    NUMERIC(10, 3),
    batch_number         VARCHAR(100),
    manufacture_date     DATE,
    expiry_date          DATE,
    purchase_price       NUMERIC(12, 2),
    marked_for_writeoff  BOOLEAN NOT NULL DEFAULT FALSE,
    notes                VARCHAR(255)
);

CREATE TABLE shipment_request (
    request_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id        UUID,
    warehouse_id           UUID NOT NULL,
    recipient_name         VARCHAR(255),
    recipient_address      VARCHAR(512),
    recipient_inn          VARCHAR(50),
    planned_date           DATE,
    comment                TEXT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    strategy               VARCHAR(16) NOT NULL DEFAULT 'AUTO',
    shipment_type          VARCHAR(16) NOT NULL DEFAULT 'DOMESTIC',
    currency               VARCHAR(3)  NOT NULL DEFAULT 'BYN',
    document_layout        VARCHAR(16) NOT NULL DEFAULT 'HORIZONTAL',
    domestic_document_kind VARCHAR(8)  NOT NULL DEFAULT 'TN',
    recipient_country      VARCHAR(64),
    recipient_gln          VARCHAR(32),
    created_by             UUID,
    created_at             TIMESTAMP NOT NULL DEFAULT now(),
    updated_at             TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipment_request_organization_id ON shipment_request(organization_id);
CREATE INDEX idx_shipment_request_warehouse_id ON shipment_request(warehouse_id);
CREATE INDEX idx_shipment_request_status ON shipment_request(status);
CREATE INDEX idx_shipment_request_shipment_type ON shipment_request(shipment_type);

CREATE TABLE shipment_request_items (
    item_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id   UUID NOT NULL REFERENCES shipment_request(request_id) ON DELETE CASCADE,
    product_id   UUID NOT NULL,
    batch_id     UUID,
    expected_qty NUMERIC(12, 3) NOT NULL,
    picked_qty   NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit_sku     VARCHAR(20),
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX idx_shipment_request_items_request_id ON shipment_request_items(request_id);
CREATE INDEX idx_shipment_request_items_unit_sku ON shipment_request_items(unit_sku);

CREATE INDEX idx_supply_items_supply_id ON supply_items(supply_id);
CREATE INDEX idx_supply_items_product_id ON supply_items(product_id);

CREATE TABLE extraction_log (
    log_id          BIGSERIAL PRIMARY KEY,
    source          VARCHAR(50) NOT NULL,
    extracted_at    TIMESTAMP NOT NULL DEFAULT now(),
    records_found   INT,
    records_new     INT,
    success         BOOLEAN NOT NULL,
    error_message   TEXT
);

CREATE INDEX idx_extraction_log_source ON extraction_log(source);

CREATE TABLE document_counters (
    organization_id UUID NOT NULL,
    document_type   VARCHAR(50) NOT NULL,
    year            INT NOT NULL,
    counter         BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, document_type, year)
);

CREATE INDEX idx_document_counters_org_year ON document_counters(organization_id, year);

CREATE TABLE generated_documents (
    id                UUID PRIMARY KEY,
    organization_id   UUID NOT NULL,
    operation_id      UUID,
    document_type     VARCHAR(50) NOT NULL,
    document_number   VARCHAR(50) NOT NULL,
    minio_object_key  VARCHAR(255) NOT NULL,
    file_format       VARCHAR(10) NOT NULL,
    generated_by      UUID NOT NULL,
    generated_at      TIMESTAMP NOT NULL DEFAULT now(),
    payload           JSONB,
    CONSTRAINT uk_generated_documents_number
        UNIQUE (organization_id, document_type, document_number)
);

CREATE INDEX idx_generated_documents_org_op
    ON generated_documents(organization_id, operation_id);
CREATE INDEX idx_generated_documents_type
    ON generated_documents(organization_id, document_type);
CREATE INDEX idx_generated_documents_generated_at
    ON generated_documents(generated_at);


