import { endpoint } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { postgres } from "@/server/postgres";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requireAdmin();
    const id = z.uuid().parse((await params).id);
    return (
      await postgres.query(
        "SELECT id,action,entity_type,created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC,id LIMIT 100",
        [id],
      )
    ).rows;
  });
}
