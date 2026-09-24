ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN registration_source TEXT NOT NULL DEFAULT 'ADMIN';
-- Existing manually provisioned identities retain their trusted status.
UPDATE users SET email_verified_at=created_at WHERE registration_source='ADMIN';
ALTER TABLE organizations ADD COLUMN status TEXT NOT NULL DEFAULT 'APPROVED'
  CHECK(status IN ('APPROVED','SUSPENDED','BLOCKED'));
UPDATE organizations SET status='SUSPENDED' WHERE NOT active;
CREATE TABLE staff_users (
 id UUID PRIMARY KEY, username VARCHAR(320) UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN','OPERATIONS_ADMIN','SALES_ADMIN','SUPPORT_ADMIN','BILLING_ADMIN','REVIEWER','READ_ONLY')),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sessions ADD COLUMN staff_id UUID REFERENCES staff_users(id) ON DELETE CASCADE;
CREATE TABLE platform_audit_logs (
 id UUID PRIMARY KEY, staff_id UUID REFERENCES staff_users(id), user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, action TEXT NOT NULL,
 resource_id UUID, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX platform_audit_date_idx ON platform_audit_logs(created_at DESC);
CREATE TABLE email_verification_tokens (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash CHAR(64) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX verification_user_idx ON email_verification_tokens(user_id);
CREATE TABLE plans (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO plans(code,name) VALUES ('FREE','Nubra Negocios Free'),('LITE','Nubra Negocios Lite'),('BUSINESS','Nubra Negocios Business'),('ENTERPRISE','Nubra Negocios Enterprise');
CREATE TABLE features (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('BOOLEAN','LIMIT')), available BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO features(key,name,kind,available) VALUES
 ('core_business','Clientes, productos, ventas y caja','BOOLEAN',TRUE),
 ('advanced_analytics','Analytics avanzado (próximamente)','BOOLEAN',FALSE),
 ('automation_engine','Automatizaciones (próximamente)','BOOLEAN',FALSE),
 ('users','Usuarios','LIMIT',TRUE),('customers','Clientes','LIMIT',TRUE),('products','Productos','LIMIT',TRUE),
 ('csv_exports','Exportaciones CSV por mes','LIMIT',TRUE),('ai_requests','Solicitudes AI por mes (próximamente)','LIMIT',FALSE);
CREATE TABLE plan_entitlements (
 plan_id UUID NOT NULL REFERENCES plans(id), feature_id UUID NOT NULL REFERENCES features(id),
 enabled BOOLEAN NOT NULL DEFAULT TRUE, limit_value INTEGER CHECK(limit_value>=0),
 PRIMARY KEY(plan_id,feature_id)
);
INSERT INTO plan_entitlements(plan_id,feature_id,enabled,limit_value)
 SELECT p.id,f.id,CASE WHEN f.key IN ('advanced_analytics','automation_engine') THEN p.code IN ('BUSINESS','ENTERPRISE') ELSE TRUE END,
 CASE f.key WHEN 'users' THEN CASE p.code WHEN 'FREE' THEN 1 WHEN 'LITE' THEN 5 WHEN 'BUSINESS' THEN 25 ELSE 100 END
 WHEN 'customers' THEN CASE p.code WHEN 'FREE' THEN 2000 WHEN 'LITE' THEN 10000 WHEN 'BUSINESS' THEN 100000 ELSE 500000 END
 WHEN 'products' THEN CASE p.code WHEN 'FREE' THEN 2000 WHEN 'LITE' THEN 10000 WHEN 'BUSINESS' THEN 100000 ELSE 500000 END
 WHEN 'csv_exports' THEN CASE p.code WHEN 'FREE' THEN 10 WHEN 'LITE' THEN 100 WHEN 'BUSINESS' THEN 1000 ELSE 10000 END
 WHEN 'ai_requests' THEN CASE p.code WHEN 'FREE' THEN 10 WHEN 'LITE' THEN 100 WHEN 'BUSINESS' THEN 1000 ELSE 5000 END END
 FROM plans p CROSS JOIN features f;
CREATE TABLE subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan_id UUID NOT NULL REFERENCES plans(id), status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED')),
 source TEXT NOT NULL CHECK(source IN ('FREE_REGISTRATION','DIRECT_PURCHASE','NUBRA_BASIC_BUNDLE','NUBRA_ENTERPRISE_BUNDLE','MANUAL_GRANT','PROMOTION','MIGRATION')),
 expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO subscriptions(organization_id,plan_id,source) SELECT o.id,p.id,'MIGRATION' FROM organizations o CROSS JOIN plans p WHERE p.code='FREE';
CREATE TABLE subscription_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 staff_id UUID REFERENCES staff_users(id), previous_plan TEXT, plan TEXT NOT NULL, source TEXT NOT NULL, reason VARCHAR(1000) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE usage_records (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, feature_id UUID NOT NULL REFERENCES features(id),
 period DATE NOT NULL, amount INTEGER NOT NULL DEFAULT 0 CHECK(amount>=0), PRIMARY KEY(organization_id,feature_id,period)
);
CREATE TABLE organization_applications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING','UNDER_REVIEW','NEEDS_INFORMATION','APPROVED','REJECTED','SUSPENDED','BLOCKED')),
 business_data JSONB NOT NULL DEFAULT '{}', requested_plan TEXT NOT NULL DEFAULT 'FREE' REFERENCES plans(code),
 review_message VARCHAR(1000) NOT NULL DEFAULT '', reviewed_by UUID REFERENCES staff_users(id), reviewed_at TIMESTAMPTZ,
 submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX applications_status_idx ON organization_applications(status,created_at);
CREATE TABLE legal_documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT UNIQUE NOT NULL CHECK(slug IN ('privacy','terms')), title TEXT NOT NULL
);
CREATE TABLE legal_document_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), document_id UUID NOT NULL REFERENCES legal_documents(id),
 version TEXT NOT NULL, content TEXT NOT NULL, review_status TEXT NOT NULL DEFAULT 'LEGAL_REVIEW_REQUIRED',
 current BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(document_id,version)
);
CREATE UNIQUE INDEX legal_current_idx ON legal_document_versions(document_id) WHERE current;
CREATE TABLE legal_acceptances (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version_id UUID NOT NULL REFERENCES legal_document_versions(id),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, application_id UUID REFERENCES organization_applications(id) ON DELETE CASCADE,
 organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(version_id,user_id)
);
CREATE TABLE upgrade_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id), requested_plan TEXT NOT NULL REFERENCES plans(code),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESOLVED')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX upgrade_pending_idx ON upgrade_requests(organization_id) WHERE status='PENDING';
CREATE TABLE roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT UNIQUE NOT NULL);
CREATE TABLE permissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT UNIQUE NOT NULL);
CREATE TABLE role_permissions (role_id UUID REFERENCES roles(id),permission_id UUID REFERENCES permissions(id),PRIMARY KEY(role_id,permission_id));
INSERT INTO roles(key) VALUES ('OWNER'),('ADMINISTRATOR'),('ADMIN'),('MANAGER'),('SALES'),('CASHIER'),('INVENTORY'),('OPERATIONS'),('FINANCE'),('SUPPORT'),('VIEWER'),('CUSTOM');
INSERT INTO permissions(key) SELECT r||'.'||a FROM unnest(ARRAY['customers','products','inventory','sales','quotes','cash','members']) r CROSS JOIN unnest(ARRAY['read','write']) a;
INSERT INTO role_permissions SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE
 r.key IN ('OWNER','ADMINISTRATOR','ADMIN') OR (r.key='MANAGER' AND p.key NOT LIKE 'members.%') OR
 (r.key='SALES' AND (p.key LIKE '%.read' AND p.key NOT LIKE 'members.%' OR p.key IN ('customers.write','sales.write','quotes.write'))) OR
 (r.key='CASHIER' AND p.key IN ('cash.read','cash.write','sales.read','sales.write','products.read','customers.read')) OR
 (r.key IN ('INVENTORY','OPERATIONS') AND (p.key LIKE 'inventory.%' OR p.key LIKE 'products.%')) OR
 (r.key='FINANCE' AND p.key IN ('cash.read','cash.write','sales.read','quotes.read')) OR
 (r.key='SUPPORT' AND p.key='customers.read') OR (r.key='VIEWER' AND p.key LIKE '%.read' AND p.key NOT LIKE 'members.%');
ALTER TABLE sales ADD COLUMN idempotency_key UUID;
ALTER TABLE sales ADD COLUMN request_hash CHAR(64);
ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED'));
CREATE UNIQUE INDEX sales_idempotency_idx ON sales(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE inventory_movements ADD COLUMN previous_quantity INTEGER;
ALTER TABLE inventory_movements ADD COLUMN new_quantity INTEGER;
ALTER TABLE inventory_movements ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE inventory_movements ADD COLUMN reference_id UUID;
