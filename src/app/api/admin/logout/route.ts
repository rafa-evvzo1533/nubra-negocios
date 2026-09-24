import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { ADMIN_COOKIE, hashToken } from "@/server/auth";
import { postgres } from "@/server/postgres";
import { endpoint } from "@/server/http";
export async function POST() {
  return endpoint(async () => {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE)?.value;
    if (token)
      await postgres.query(
        "WITH removed AS (DELETE FROM sessions WHERE kind='admin' AND token_hash=$1 RETURNING staff_id) INSERT INTO platform_audit_logs(id,staff_id,action) SELECT $2,staff_id,'auth.staff_logout' FROM removed",
        [hashToken(token), randomUUID()],
      );
    jar.delete(ADMIN_COOKIE);
    return { authenticated: false };
  });
}
