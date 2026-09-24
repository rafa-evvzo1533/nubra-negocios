ALTER TABLE organizations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_reference VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS sales_receipt_reference_idx ON sales(organization_id,source_reference) WHERE source='RECEIPT' AND source_reference IS NOT NULL;
CREATE TABLE IF NOT EXISTS receipt_imports (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 sale_id UUID NOT NULL, image_hash CHAR(64) NOT NULL, image_data BYTEA NOT NULL, mime_type VARCHAR(32) NOT NULL,
 description VARCHAR(500) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,image_hash), UNIQUE(organization_id,sale_id),
 FOREIGN KEY(organization_id,sale_id) REFERENCES sales(organization_id,id)
);
CREATE TABLE IF NOT EXISTS cash_sessions (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 opening_cents BIGINT NOT NULL CHECK(opening_cents>=0), counted_cents BIGINT, expected_cents BIGINT,
 opened_by UUID REFERENCES users(id), closed_by UUID REFERENCES users(id),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ,
 UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_idx ON cash_sessions(organization_id) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS payments (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 sale_id UUID NOT NULL, cash_session_id UUID, amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 method VARCHAR(20) NOT NULL CHECK(method IN ('CASH','TRANSFER','CARD','OTHER')),
 reference VARCHAR(160) NOT NULL DEFAULT '', idempotency_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), user_id UUID REFERENCES users(id),
 UNIQUE(organization_id,id), UNIQUE(organization_id,idempotency_key),
 FOREIGN KEY(organization_id,sale_id) REFERENCES sales(organization_id,id),
 FOREIGN KEY(organization_id,cash_session_id) REFERENCES cash_sessions(organization_id,id)
);
CREATE TABLE IF NOT EXISTS cash_movements (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 cash_session_id UUID NOT NULL, payment_id UUID, amount_cents BIGINT NOT NULL CHECK(amount_cents<>0),
 reason VARCHAR(240) NOT NULL, idempotency_key UUID NOT NULL,
 user_id UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,idempotency_key), UNIQUE(organization_id,payment_id),
 FOREIGN KEY(organization_id,cash_session_id) REFERENCES cash_sessions(organization_id,id),
 FOREIGN KEY(organization_id,payment_id) REFERENCES payments(organization_id,id)
);
CREATE INDEX IF NOT EXISTS payments_org_sale_idx ON payments(organization_id,sale_id);
CREATE INDEX IF NOT EXISTS cash_movements_org_session_idx ON cash_movements(organization_id,cash_session_id);
