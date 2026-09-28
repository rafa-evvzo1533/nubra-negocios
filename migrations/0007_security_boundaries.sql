-- Runtime has no ownership, DDL, superuser or BYPASSRLS privileges.
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='nubra_runtime') THEN CREATE ROLE nubra_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $$;
GRANT nubra_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO nubra_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO nubra_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO nubra_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_logs,platform_audit_logs FROM nubra_runtime;
ALTER TABLE inventory_movements ADD COLUMN idempotency_key UUID;
CREATE UNIQUE INDEX inventory_idempotency_idx ON inventory_movements(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN device_label TEXT NOT NULL DEFAULT 'Navegador';
ALTER TABLE sessions ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE staff_users DROP CONSTRAINT staff_users_role_check;
ALTER TABLE staff_users ADD CHECK(role IN ('SUPER_ADMIN','OPERATIONS_ADMIN','SALES_ADMIN','SUPPORT_ADMIN','BILLING_ADMIN','SECURITY_ADMIN','REVIEWER','READ_ONLY'));
CREATE TABLE support_access_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 staff_id UUID NOT NULL REFERENCES staff_users(id),reason VARCHAR(1000) NOT NULL,scope TEXT[] NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes IN(15,30,60,240)),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED','REVOKED')),
 approved_by UUID REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),decided_at TIMESTAMPTZ,
 UNIQUE(id,organization_id)
);
CREATE TABLE support_access_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),request_id UUID NOT NULL UNIQUE REFERENCES support_access_requests(id),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,staff_id UUID NOT NULL REFERENCES staff_users(id),scope TEXT[] NOT NULL,
 approved_by UUID NOT NULL REFERENCES users(id),expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE private_file_links (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id),receipt_id UUID NOT NULL,token_hash CHAR(64) UNIQUE NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE organization_encryption_keys (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,key_version INTEGER NOT NULL,
 provider TEXT NOT NULL,key_reference TEXT NOT NULL,wrapped_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),rotated_at TIMESTAMPTZ,
 PRIMARY KEY(organization_id,key_version)
);
CREATE TABLE emergency_access_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),organization_id UUID NOT NULL REFERENCES organizations(id),staff_id UUID NOT NULL REFERENCES staff_users(id),
 reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'DISABLED' CHECK(status='DISABLED'),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON support_access_requests,support_access_grants,private_file_links,organization_encryption_keys TO nubra_runtime;
GRANT SELECT ON emergency_access_requests TO nubra_runtime;
-- No ordinary sales employee reads cash totals or the finance dashboard.
DELETE FROM role_permissions WHERE role_id=(SELECT id FROM roles WHERE key='SALES') AND permission_id IN(SELECT id FROM permissions WHERE key LIKE 'cash.%');
INSERT INTO permissions(key) VALUES('data.export'),('finance.read'),('sales.analytics') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.key IN('OWNER','ADMINISTRATOR','ADMIN','MANAGER','FINANCE') AND p.key IN('data.export','finance.read','sales.analytics') ON CONFLICT DO NOTHING;
-- Tenant context also proves active membership. Support is read-only and scoped separately.
CREATE FUNCTION nubra_tenant_access(org UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT org=NULLIF(current_setting('app.organization_id',true),'')::uuid AND EXISTS(
 SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=org AND m.user_id=NULLIF(current_setting('app.user_id',true),'')::uuid AND o.active AND o.status='APPROVED')
$$;
CREATE FUNCTION nubra_support_access(org UUID,scope_key TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM support_access_grants g JOIN staff_users s ON s.id=g.staff_id JOIN organizations o ON o.id=g.organization_id
 WHERE g.id=NULLIF(current_setting('app.support_grant_id',true),'')::uuid AND g.staff_id=NULLIF(current_setting('app.staff_id',true),'')::uuid AND g.organization_id=org AND scope_key=ANY(g.scope) AND g.expires_at>NOW() AND g.revoked_at IS NULL AND s.active AND o.active AND o.status='APPROVED')
$$;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['customers','products','sales','sale_items','inventory_movements','customer_activities','quotes','quote_items','receipt_imports','payments','cash_sessions','cash_movements','fiscal_profiles','fiscal_credentials','fiscal_point_of_sales','fiscal_invoices','fiscal_invoice_items','fiscal_attempts','private_file_links','organization_encryption_keys'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO nubra_runtime USING(nubra_tenant_access(organization_id)) WITH CHECK(nubra_tenant_access(organization_id))',t);
 END LOOP;
END $$;
CREATE POLICY support_customers ON customers FOR SELECT TO nubra_runtime USING(nubra_support_access(organization_id,'customers.read'));
CREATE POLICY support_products ON products FOR SELECT TO nubra_runtime USING(nubra_support_access(organization_id,'inventory.read'));
CREATE POLICY support_inventory ON inventory_movements FOR SELECT TO nubra_runtime USING(nubra_support_access(organization_id,'inventory.read'));
CREATE POLICY support_sales ON sales FOR SELECT TO nubra_runtime USING(nubra_support_access(organization_id,'sales.read'));
-- Business audit content is tenant-private, platform events contain metadata only.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_logs FOR SELECT TO nubra_runtime USING(nubra_tenant_access(organization_id));
CREATE POLICY audit_append ON audit_logs FOR INSERT TO nubra_runtime WITH CHECK(true);
