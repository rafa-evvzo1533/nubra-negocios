ALTER TABLE support_access_grants ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE support_access_grants ADD COLUMN expiry_recorded_at TIMESTAMPTZ;
CREATE INDEX support_grants_staff_expiry_idx ON support_access_grants(staff_id,expires_at);
CREATE INDEX support_requests_org_created_idx ON support_access_requests(organization_id,created_at DESC);
