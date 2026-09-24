import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { USER_COOKIE, hashToken } from "@/server/auth";
import { postgres } from "@/server/postgres";
import { endpoint } from "@/server/http";
export async function POST() {
  return endpoint(async () => {
    const jar = await cookies();
    const token = jar.get(USER_COOKIE)?.value;
    if (token)
      await postgres.query(
        "WITH removed AS (DELETE FROM sessions WHERE token_hash=$1 AND kind='user' RETURNING user_id) INSERT INTO platform_audit_logs(id,user_id,action) SELECT $2,user_id,'auth.logout' FROM removed",
        [hashToken(token), randomUUID()],
      );
    jar.delete(USER_COOKIE);
    return { authenticated: false };
  });
}
