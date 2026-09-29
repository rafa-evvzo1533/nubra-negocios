ALTER TABLE plans ADD COLUMN annual_price_cents INTEGER CHECK(annual_price_cents>0);
ALTER TABLE plans ADD COLUMN annual_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE billing_orders ADD COLUMN billing_period TEXT NOT NULL DEFAULT 'LEGACY_30_DAYS' CHECK(billing_period IN('MONTHLY','YEARLY','LEGACY_30_DAYS'));
ALTER TABLE billing_orders ALTER COLUMN billing_period SET DEFAULT 'MONTHLY';
-- Existing orders retain the original 30-day promise. New orders purchase calendar months/years.
UPDATE plan_entitlements e SET limit_value=v.amount
FROM plans p,features f,(VALUES
 ('FREE','users',1),('FREE','customers',30),('FREE','products',50),('FREE','suppliers',5),('FREE','monthly_sales',100),('FREE','csv_exports',2),
 ('LITE','users',2),('LITE','customers',150),('LITE','products',250),('LITE','suppliers',20),('LITE','monthly_sales',1000),('LITE','csv_exports',10),
 ('BUSINESS','users',5),('BUSINESS','customers',500),('BUSINESS','products',600),('BUSINESS','suppliers',60),('BUSINESS','monthly_sales',5000),('BUSINESS','csv_exports',50),
 ('ENTERPRISE','users',10),('ENTERPRISE','customers',1000),('ENTERPRISE','products',1500),('ENTERPRISE','suppliers',150),('ENTERPRISE','monthly_sales',15000),('ENTERPRISE','csv_exports',200)
) AS v(plan,feature,amount) WHERE e.plan_id=p.id AND e.feature_id=f.id AND p.code=v.plan AND f.key=v.feature;
