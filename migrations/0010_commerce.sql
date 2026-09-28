CREATE TABLE suppliers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name VARCHAR(120) NOT NULL,email VARCHAR(320) NOT NULL DEFAULT '',phone VARCHAR(40) NOT NULL DEFAULT '',category VARCHAR(80) NOT NULL DEFAULT '',notes VARCHAR(2000) NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(organization_id,id)
);
ALTER TABLE products ADD COLUMN supplier_id UUID;
ALTER TABLE products ADD COLUMN category VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN unit VARCHAR(24) NOT NULL DEFAULT 'unidad';
ALTER TABLE products ADD COLUMN cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents>=0);
ALTER TABLE products ADD FOREIGN KEY(organization_id,supplier_id) REFERENCES suppliers(organization_id,id);
ALTER TABLE sale_items ADD COLUMN cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents>=0);
CREATE TABLE commerce_requests(organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,idempotency_key UUID NOT NULL,kind TEXT NOT NULL,request_hash CHAR(64) NOT NULL,result JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(organization_id,idempotency_key));
DO $$ DECLARE t TEXT;BEGIN FOREACH t IN ARRAY ARRAY['suppliers','commerce_requests'] LOOP
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO nubra_runtime',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL TO nubra_runtime USING(nubra_tenant_access(organization_id)) WITH CHECK(nubra_tenant_access(organization_id))',t);
END LOOP;END $$;
INSERT INTO permissions(key) VALUES('suppliers.read'),('suppliers.write'),('reports.read'),('accounts.read'),('accounts.write'),('audit.read') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE p.key IN ('suppliers.read','suppliers.write','reports.read','accounts.read','accounts.write','audit.read') AND (
 r.key IN('OWNER','ADMINISTRATOR','ADMIN','MANAGER') OR (r.key='FINANCE' AND p.key IN('reports.read','accounts.read','accounts.write')) OR (r.key IN('INVENTORY','OPERATIONS') AND p.key LIKE 'suppliers.%') OR (r.key='CASHIER' AND p.key IN('accounts.read','accounts.write'))
) ON CONFLICT DO NOTHING;
INSERT INTO features(key,name,kind,available) VALUES('monthly_sales','Ventas por mes','LIMIT',TRUE),('suppliers','Proveedores','LIMIT',TRUE),('reports','Reportes por período','BOOLEAN',TRUE),('accounts','Cuenta corriente','BOOLEAN',TRUE) ON CONFLICT DO NOTHING;
INSERT INTO plan_entitlements(plan_id,feature_id,enabled,limit_value) SELECT p.id,f.id,TRUE,CASE WHEN f.kind='LIMIT' THEN CASE p.code WHEN 'FREE' THEN CASE f.key WHEN 'monthly_sales' THEN 100 ELSE 10 END WHEN 'LITE' THEN CASE f.key WHEN 'monthly_sales' THEN 1000 ELSE 100 END WHEN 'BUSINESS' THEN CASE f.key WHEN 'monthly_sales' THEN 10000 ELSE 1000 END ELSE 100000 END ELSE NULL END FROM plans p CROSS JOIN features f WHERE f.key IN('monthly_sales','suppliers','reports','accounts') ON CONFLICT DO NOTHING;
UPDATE plan_entitlements e SET limit_value=CASE p.code WHEN 'FREE' THEN CASE f.key WHEN 'users' THEN 1 WHEN 'customers' THEN 50 WHEN 'products' THEN 100 WHEN 'csv_exports' THEN 2 END WHEN 'LITE' THEN CASE f.key WHEN 'users' THEN 3 WHEN 'customers' THEN 500 WHEN 'products' THEN 1000 WHEN 'csv_exports' THEN 20 END WHEN 'BUSINESS' THEN CASE f.key WHEN 'users' THEN 15 WHEN 'customers' THEN 10000 WHEN 'products' THEN 10000 WHEN 'csv_exports' THEN 200 END ELSE CASE f.key WHEN 'users' THEN 100 WHEN 'customers' THEN 500000 WHEN 'products' THEN 500000 WHEN 'csv_exports' THEN 2000 END END FROM plans p,features f WHERE e.plan_id=p.id AND e.feature_id=f.id AND f.key IN('users','customers','products','csv_exports');
-- Carry existing monthly sales into the new quota; never delete existing records.
INSERT INTO usage_records(organization_id,feature_id,period,amount) SELECT s.organization_id,f.id,date_trunc('month',NOW() AT TIME ZONE 'UTC')::date,COUNT(*)::int FROM sales s CROSS JOIN features f WHERE f.key='monthly_sales' AND s.created_at>=date_trunc('month',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY s.organization_id,f.id ON CONFLICT DO NOTHING;
