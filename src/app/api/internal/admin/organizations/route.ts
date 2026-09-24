import { endpoint } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { postgres } from "@/server/postgres";
export async function GET() {
  return endpoint(async () => {
    await requireAdmin("read");
    return (
      await postgres.query(`SELECT o.id,o.name,o.status,p.code AS plan,s.source,s.expires_at,
 (SELECT COUNT(*)::int FROM organization_members m WHERE m.organization_id=o.id) AS users,
 (SELECT requested_plan FROM upgrade_requests u WHERE u.organization_id=o.id AND u.status='PENDING') AS requested_plan
 FROM organizations o LEFT JOIN subscriptions s ON s.organization_id=o.id LEFT JOIN plans p ON p.id=s.plan_id ORDER BY o.created_at DESC LIMIT 200`)
    ).rows;
  });
}
