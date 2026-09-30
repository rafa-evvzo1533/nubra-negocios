ALTER TABLE subscriptions ADD COLUMN trial_claimed_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_source_check;
ALTER TABLE subscriptions ADD CHECK(source IN ('FREE_REGISTRATION','DIRECT_PURCHASE','NUBRA_BASIC_BUNDLE','NUBRA_ENTERPRISE_BUNDLE','MANUAL_GRANT','PROMOTION','MIGRATION','BUSINESS_TRIAL'));

CREATE TABLE billing_agreements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id), plan_id UUID NOT NULL REFERENCES plans(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), currency CHAR(3) NOT NULL DEFAULT 'ARS',
 status TEXT NOT NULL DEFAULT 'CREATING' CHECK(status IN('CREATING','PENDING','AUTHORIZED','PAUSED','CANCELLED','REVIEW')),
 provider_id TEXT UNIQUE, checkout_url TEXT, idempotency_key UUID NOT NULL,
 next_payment_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organization_id,idempotency_key)
);
CREATE UNIQUE INDEX one_open_billing_agreement ON billing_agreements(organization_id) WHERE status<>'CANCELLED';
ALTER TABLE billing_orders ADD COLUMN agreement_id UUID REFERENCES billing_agreements(id);
ALTER TABLE billing_orders ADD COLUMN invoice_id TEXT UNIQUE;
GRANT SELECT,INSERT,UPDATE ON billing_agreements TO nubra_runtime;

CREATE FUNCTION nubra_expire_trials(target UUID DEFAULT NULL) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE total INTEGER;
BEGIN
 WITH expired AS (
  UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='FREE'),source='FREE_REGISTRATION',
   status='ACTIVE',expires_at=NULL,billing_order_id=NULL,updated_at=NOW()
  WHERE source='BUSINESS_TRIAL' AND trial_ends_at<=NOW() AND (target IS NULL OR organization_id=target)
  RETURNING organization_id
 ), history AS (
  INSERT INTO subscription_history(organization_id,previous_plan,plan,source,reason)
  SELECT organization_id,'BUSINESS','FREE','BUSINESS_TRIAL','Finalizaron los 14 días de prueba. Sin cobros.' FROM expired
 ) SELECT COUNT(*) INTO total FROM expired;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION nubra_expire_trials(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nubra_expire_trials(UUID) TO nubra_runtime;
