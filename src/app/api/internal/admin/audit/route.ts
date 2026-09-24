import { endpoint } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { postgres } from "@/server/postgres";
export async function GET() {
  return endpoint(async () => {
    await requireAdmin("operations");
    return (
      await postgres.query(
        "SELECT a.id,a.action,a.resource_id,a.created_at,s.username FROM platform_audit_logs a LEFT JOIN staff_users s ON s.id=a.staff_id ORDER BY a.created_at DESC LIMIT 200",
      )
    ).rows;
  });
}
