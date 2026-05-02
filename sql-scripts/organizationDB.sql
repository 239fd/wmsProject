CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE org_status AS ENUM ('ACTIVE', 'BLOCKED', 'ARCHIVED');

CREATE TABLE organization_read_model (
    org_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    short_name      VARCHAR(255),
    unp             VARCHAR(20) NOT NULL,
    address         VARCHAR(512),
    status          org_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uk_organization_name UNIQUE (name),
    CONSTRAINT uk_organization_unp UNIQUE (unp),
    CONSTRAINT chk_organization_unp_format CHECK (unp ~ '^\d{9}$')
);

CREATE TABLE organization_events (
    event_id        BIGSERIAL PRIMARY KEY,
    org_id          UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    event_version   INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_organization_events_org_id ON organization_events(org_id);

CREATE TABLE organization_employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    org_id          UUID NOT NULL,
    role            VARCHAR(50) NOT NULL,
    joined_at       TIMESTAMP NOT NULL DEFAULT now(),
    removed_at      TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_at      TIMESTAMP,
    CONSTRAINT fk_org_employee_org FOREIGN KEY (org_id) REFERENCES organization_read_model(org_id) ON DELETE CASCADE,
    CONSTRAINT uk_user_org UNIQUE (user_id, org_id)
);

CREATE INDEX idx_organization_employees_user_id ON organization_employees(user_id);
CREATE INDEX idx_organization_employees_org_id ON organization_employees(org_id);
CREATE INDEX idx_organization_employees_is_active ON organization_employees(is_active);

CREATE TABLE organization_invitation_codes (
    code_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id           UUID NOT NULL,
    warehouse_id     UUID,
    invitation_code  VARCHAR(64) NOT NULL UNIQUE,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    expires_at       TIMESTAMP NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_invitation_org FOREIGN KEY (org_id) REFERENCES organization_read_model(org_id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_codes_org_id ON organization_invitation_codes(org_id);
CREATE INDEX idx_invitation_codes_code ON organization_invitation_codes(invitation_code) WHERE is_active = TRUE;

CREATE TABLE organization_invitations (
    invitation_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invitation_token    UUID NOT NULL UNIQUE,
    org_id              UUID NOT NULL,
    email               VARCHAR(255) NOT NULL,
    role                VARCHAR(50) NOT NULL,
    warehouse_id        UUID,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    expires_at          TIMESTAMP NOT NULL,
    used                BOOLEAN NOT NULL DEFAULT FALSE,
    used_at             TIMESTAMP,
    used_by             UUID,
    CONSTRAINT fk_invitation_org FOREIGN KEY (org_id) REFERENCES organization_read_model(org_id) ON DELETE CASCADE
);

CREATE INDEX idx_invitations_token ON organization_invitations(invitation_token);
CREATE INDEX idx_invitations_org_id ON organization_invitations(org_id);
CREATE INDEX idx_invitations_email ON organization_invitations(email);
