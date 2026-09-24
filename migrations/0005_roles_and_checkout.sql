CREATE TABLE organization_roles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name VARCHAR(80) NOT NULL, description VARCHAR(300) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,name)
);
CREATE TABLE organization_role_permissions (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 role_id UUID NOT NULL, permission_id UUID NOT NULL REFERENCES permissions(id),
 PRIMARY KEY(organization_id,role_id,permission_id),
 FOREIGN KEY(organization_id,role_id) REFERENCES organization_roles(organization_id,id) ON DELETE CASCADE
);
ALTER TABLE organization_members ADD COLUMN custom_role_id UUID;
ALTER TABLE organization_members ADD CONSTRAINT member_custom_role_fk FOREIGN KEY(organization_id,custom_role_id) REFERENCES organization_roles(organization_id,id);
ALTER TABLE organization_members ADD CONSTRAINT member_custom_role_kind CHECK(custom_role_id IS NULL OR role='CUSTOM');
INSERT INTO features(key,name,kind,available) VALUES ('custom_roles','Roles propios del negocio','BOOLEAN',TRUE);
INSERT INTO plan_entitlements(plan_id,feature_id,enabled) SELECT p.id,f.id,TRUE FROM plans p CROSS JOIN features f WHERE f.key='custom_roles';
ALTER TABLE plans ADD COLUMN price_cents INTEGER CHECK(price_cents>0);
ALTER TABLE plans ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'ARS';
ALTER TABLE plans ADD COLUMN checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE billing_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id), plan_id UUID NOT NULL REFERENCES plans(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), currency CHAR(3) NOT NULL,
 status TEXT NOT NULL DEFAULT 'CREATING' CHECK(status IN ('CREATING','PENDING','PAID','FAILED','REFUNDED','REVIEW')),
 provider TEXT NOT NULL DEFAULT 'MERCADO_PAGO', preference_id TEXT UNIQUE, payment_id TEXT UNIQUE, checkout_url TEXT,
 idempotency_key UUID NOT NULL, paid_at TIMESTAMPTZ, period_end TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,idempotency_key)
);
CREATE INDEX billing_orders_org_idx ON billing_orders(organization_id,created_at DESC);
CREATE TABLE billing_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id TEXT NOT NULL, provider_status TEXT NOT NULL,
 order_id UUID REFERENCES billing_orders(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(payment_id,provider_status)
);
