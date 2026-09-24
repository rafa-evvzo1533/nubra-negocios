import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readJson, endpoint, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { transaction } from "@/server/transactions";
import { planCatalog, planCode } from "@/server/subscriptions";
export async function GET() {
  return endpoint(async () => {
    await requireAdmin("read");
    return planCatalog();
  });
}
export async function PATCH(request: Request) {
  return endpoint(async () => {
    const actor = await requireAdmin("billing");
    const v = z
      .object({
        plan: planCode,
        feature: z.string().min(1).max(80),
        enabled: z.boolean(),
        limit: z.number().int().min(0).max(10000000).nullable(),
        reason: z.string().trim().min(3).max(1000),
      })
      .strict()
      .parse(await readJson(request));
    return transaction(async (db) => {
      const r = await db.query(
        `UPDATE plan_entitlements e SET enabled=$3,limit_value=$4 FROM plans p,features f WHERE e.plan_id=p.id AND e.feature_id=f.id AND p.code=$1 AND f.key=$2 AND ((f.kind='LIMIT' AND $4::int IS NOT NULL) OR (f.kind='BOOLEAN' AND $4::int IS NULL)) RETURNING p.id`,
        [v.plan, v.feature, v.enabled, v.limit],
      );
      if (!r.rows.length)
        throw new HttpError(400, "Capacidad o límite inválido");
      await db.query(
        "INSERT INTO platform_audit_logs(id,staff_id,action,metadata) VALUES($1,$2,'entitlement.changed',$3)",
        [randomUUID(), actor.id, JSON.stringify(v)],
      );
      return { updated: true };
    });
  });
}
