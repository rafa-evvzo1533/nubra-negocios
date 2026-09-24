ALTER TABLE subscriptions ADD COLUMN billing_order_id UUID REFERENCES billing_orders(id) ON DELETE SET NULL;
CREATE TABLE member_invitations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 email VARCHAR(320) NOT NULL, role VARCHAR(32) NOT NULL, custom_role_id UUID,
 invited_by UUID NOT NULL REFERENCES users(id), token_hash CHAR(64) UNIQUE NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REVOKED')),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY(organization_id,custom_role_id) REFERENCES organization_roles(organization_id,id)
);
CREATE UNIQUE INDEX invitations_pending_email_idx ON member_invitations(organization_id,email) WHERE status='PENDING';
