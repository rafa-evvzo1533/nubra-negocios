import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAccountSession, hashToken, USER_COOKIE } from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
export async function listSessions() {
  const account = await getAccountSession();
  if (!account) throw new HttpError(401, "Iniciá sesión");
  const hash = hashToken((await cookies()).get(USER_COOKIE)!.value);
  return (
    await postgres.query(
      "SELECT id,device_label,created_at,last_seen_at,expires_at,revoked_at,(token_hash=$2) AS current FROM sessions WHERE user_id=$1 AND kind='user' ORDER BY created_at DESC LIMIT 50",
      [account.id, hash],
    )
  ).rows;
}
export async function revokeSessions(body: unknown) {
  const account = await getAccountSession();
  if (!account) throw new HttpError(401, "Iniciá sesión");
  const v = z
    .object({
      target: z.union([z.uuid(), z.literal("others"), z.literal("all")]),
    })
    .strict()
    .parse(body);
  const hash = hashToken((await cookies()).get(USER_COOKIE)!.value);
  return transaction(async (db) => {
    await db.query(
      `UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1 AND kind='user' AND revoked_at IS NULL AND ${v.target === "others" ? "token_hash<>$2" : v.target === "all" ? "true" : "id=$2::uuid"}`,
      [
        account.id,
        ...(v.target === "all"
          ? []
          : [v.target === "others" ? hash : v.target]),
      ],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,user_id,action) VALUES($1,$2,'SESSION_REVOKED')",
      [randomUUID(), account.id],
    );
    return { revoked: true };
  });
}
