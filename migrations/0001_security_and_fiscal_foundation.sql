CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens(user_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_id VARCHAR(20) NOT NULL,
  legal_name VARCHAR(160) NOT NULL,
  fiscal_condition VARCHAR(80) NOT NULL,
  address TEXT NOT NULL,
  environment VARCHAR(16) NOT NULL CHECK (environment IN ('HOMOLOGATION', 'PRODUCTION')),
  service_name VARCHAR(32) NOT NULL DEFAULT 'WSFEV1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id),
  UNIQUE (organization_id, tax_id, environment)
);

CREATE TABLE IF NOT EXISTS fiscal_credentials (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_profile_id UUID NOT NULL REFERENCES fiscal_profiles(id) ON DELETE CASCADE,
  certificate_ciphertext TEXT NOT NULL,
  private_key_ciphertext TEXT NOT NULL,
  key_version VARCHAR(32) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fiscal_profile_id)
);

CREATE TABLE IF NOT EXISTS fiscal_point_of_sales (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_profile_id UUID NOT NULL REFERENCES fiscal_profiles(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number > 0),
  description VARCHAR(160) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, fiscal_profile_id, number)
);

CREATE TABLE IF NOT EXISTS fiscal_invoices (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_profile_id UUID NOT NULL REFERENCES fiscal_profiles(id),
  point_of_sale_id UUID NOT NULL REFERENCES fiscal_point_of_sales(id),
  sale_id UUID,
  idempotency_key VARCHAR(160) NOT NULL,
  environment VARCHAR(16) NOT NULL CHECK (environment IN ('HOMOLOGATION', 'PRODUCTION')),
  invoice_type VARCHAR(8) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('DRAFT', 'PENDING', 'AUTHORIZED', 'REJECTED', 'UNCERTAIN')),
  issuer_snapshot JSONB NOT NULL,
  receiver_snapshot JSONB NOT NULL,
  totals_snapshot JSONB NOT NULL,
  cae VARCHAR(32),
  cae_expiration DATE,
  official_number BIGINT,
  official_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS fiscal_invoice_items (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_invoice_id UUID NOT NULL REFERENCES fiscal_invoices(id) ON DELETE CASCADE,
  description VARCHAR(240) NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  tax_snapshot JSONB NOT NULL,
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS fiscal_attempts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fiscal_invoice_id UUID NOT NULL REFERENCES fiscal_invoices(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(160) NOT NULL,
  status VARCHAR(24) NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'REJECTED', 'UNCERTAIN')),
  request_snapshot JSONB NOT NULL,
  response_snapshot JSONB,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS fiscal_invoices_org_status_idx
  ON fiscal_invoices(organization_id, status, created_at);