import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { getUserSession } from "./auth";
import { requireAdmin } from "./admin";
import { HttpError } from "./http";
import type { SessionContext } from "./tenant";
import { billingReady } from "./mercado-pago";
import { periodEnd } from "@/domain/billing-period";

export const planCode = z.enum(["FREE", "LITE", "BUSINESS", "ENTERPRISE"]);
export const subscriptionSource = z.enum([
  "FREE_REGISTRATION",
  "DIRECT_PURCHASE",
  "NUBRA_BASIC_BUNDLE",
  "NUBRA_ENTERPRISE_BUNDLE",
  "MANUAL_GRANT",
  "PROMOTION",
  "MIGRATION",
]);
type Db = Pick<PoolClient, "query">;
export async function entitlements(organizationId: string, db: Db = postgres) {
  return (
    await db.query<{
      key: string;
      name: string;
      enabled: boolean;
      available: boolean;
      limit_value: number | null;
    }>(
      `SELECT f.key,f.name,e.enabled,f.available,e.limit_value FROM subscriptions s JOIN plans p ON p.id=s.plan_id
   JOIN plan_entitlements e ON e.plan_id=p.id JOIN features f ON f.id=e.feature_id
   WHERE s.organization_id=$1 AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>NOW())`,
      [organizationId],
    )
  ).rows;
}
export async function hasFeature(
  ctx: SessionContext,
  key: string,
  db: Db = postgres,
) {
  return (await entitlements(ctx.organizationId, db)).some(
    (e) => e.key === key && e.enabled && e.available,
  );
}
export const canUse = hasFeature;
export async function getLimit(
  ctx: SessionContext,
  key: string,
  db: Db = postgres,
) {
  const e = (await entitlements(ctx.organizationId, db)).find(
    (e) => e.key === key && e.enabled && e.available,
  );
  return e?.limit_value ?? 0;
}
export async function enforceCapacity(
  db: Db,
  ctx: SessionContext,
  key: "users" | "customers" | "products" | "suppliers",
) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.organizationId,
  ]);
  const table = {
    users: "organization_members",
    customers: "customers",
    products: "products",
    suppliers: "suppliers",
  }[key];
  const count = Number(
    (
      await db.query(
        `SELECT COUNT(*) AS n FROM ${table} WHERE organization_id=$1`,
        [ctx.organizationId],
      )
    ).rows[0].n,
  );
  const reserved =
    key === "users"
      ? Number(
          (
            await db.query(
              "SELECT COUNT(*) AS n FROM member_invitations WHERE organization_id=$1 AND status='PENDING' AND expires_at>NOW()",
              [ctx.organizationId],
            )
          ).rows[0].n,
        )
      : 0;
  if (count + reserved >= (await getLimit(ctx, key, db)))
    throw new HttpError(
      403,
      "Alcanzaste el límite de tu plan. Revisá tu suscripción.",
    );
}
export async function consumeUsage(
  db: Db,
  ctx: SessionContext,
  key: string,
  amount = 1,
) {
  z.number().int().positive().parse(amount);
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.organizationId,
  ]);
  const limit = await getLimit(ctx, key, db);
  const result = await db.query(
    `INSERT INTO usage_records(organization_id,feature_id,period,amount)
  SELECT $1::uuid,id,date_trunc('month',NOW() AT TIME ZONE 'UTC')::date,$3::int FROM features WHERE key=$2 AND $3::int<=$4::int
  ON CONFLICT(organization_id,feature_id,period) DO UPDATE SET amount=usage_records.amount+EXCLUDED.amount
  WHERE usage_records.amount+EXCLUDED.amount<=$4::int RETURNING amount`,
    [ctx.organizationId, key, amount, limit],
  );
  if (!result.rows.length)
    throw new HttpError(
      403,
      "Alcanzaste el límite mensual de tu plan. Podés ampliar tu capacidad en Planes y suscripción.",
    );
}
export async function subscriptionSummary() {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  const subscription = (
    await postgres.query(
      `SELECT p.code,p.name,s.source,CASE WHEN s.expires_at<=NOW() THEN 'EXPIRED' ELSE s.status END AS status,s.expires_at,s.trial_claimed_at,s.trial_ends_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE organization_id=$1`,
      [ctx.organizationId],
    )
  ).rows[0];
  const usage = (
    await postgres.query(
      `SELECT (SELECT COUNT(*) FROM organization_members WHERE organization_id=$1)::int AS users,
 (SELECT COUNT(*) FROM customers WHERE organization_id=$1)::int AS customers,(SELECT COUNT(*) FROM products WHERE organization_id=$1)::int AS products,
 COALESCE((SELECT SUM(u.amount) FROM usage_records u JOIN features f ON f.id=u.feature_id WHERE u.organization_id=$1 AND f.key='csv_exports' AND u.period=date_trunc('month',NOW() AT TIME ZONE 'UTC')::date),0)::int AS csv_exports`,
      [ctx.organizationId],
    )
  ).rows[0];
  const additional = (
    await postgres.query(
      "SELECT f.key,u.amount FROM usage_records u JOIN features f ON f.id=u.feature_id WHERE u.organization_id=$1 AND u.period=date_trunc('month',NOW() AT TIME ZONE 'UTC')::date",
      [ctx.organizationId],
    )
  ).rows;
  const suppliers = Number(
    (
      await postgres.query(
        "SELECT COUNT(*) AS n FROM suppliers WHERE organization_id=$1",
        [ctx.organizationId],
      )
    ).rows[0].n,
  );
  return {
    subscription,
    trialAvailable:
      subscription?.code === "FREE" && !subscription?.trial_claimed_at,
    recurring: ["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role)
      ? ((
          await postgres.query(
            "SELECT a.id,p.name,a.status,a.amount_cents,a.currency,a.next_payment_at,CASE WHEN a.status='PENDING' THEN a.checkout_url END AS checkout_url FROM billing_agreements a JOIN plans p ON p.id=a.plan_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 1",
            [ctx.organizationId],
          )
        ).rows[0] ?? null)
      : null,
    entitlements: await entitlements(ctx.organizationId),
    usage: {
      ...usage,
      suppliers,
      ...Object.fromEntries(additional.map((r) => [r.key, Number(r.amount)])),
    },
    plans: await planCatalog(),
    billingReady: billingReady(),
    canManage: ["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role),
  };
}
export async function planCatalog() {
  return (
    await postgres.query(
      `SELECT p.code,p.name,p.price_cents,p.currency,p.checkout_enabled,p.annual_price_cents,p.annual_checkout_enabled,json_agg(json_build_object('key',f.key,'name',f.name,'enabled',e.enabled,'available',f.available,'limit',e.limit_value) ORDER BY f.key) AS entitlements FROM plans p JOIN plan_entitlements e ON e.plan_id=p.id JOIN features f ON f.id=e.feature_id GROUP BY p.id ORDER BY CASE p.code WHEN 'FREE' THEN 1 WHEN 'LITE' THEN 2 WHEN 'BUSINESS' THEN 3 ELSE 4 END`,
    )
  ).rows;
}
export async function setSubscription(
  db: Db,
  organizationId: string,
  plan: string,
  source: string,
  staffId: string,
  reason: string,
  expiresAt: string | null = null,
) {
  const previous = (
    await db.query(
      "SELECT p.code FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
      [organizationId],
    )
  ).rows[0];
  await db.query(
    `INSERT INTO subscriptions(organization_id,plan_id,source,expires_at) SELECT $1,id,$3,$4 FROM plans WHERE code=$2
 ON CONFLICT(organization_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,source=EXCLUDED.source,expires_at=EXCLUDED.expires_at,status='ACTIVE',billing_order_id=NULL,updated_at=NOW()`,
    [organizationId, plan, source, expiresAt],
  );
  await db.query(
    "INSERT INTO subscription_history(organization_id,staff_id,previous_plan,plan,source,reason) VALUES($1,$2,$3,$4,$5,$6)",
    [organizationId, staffId, previous?.code ?? null, plan, source, reason],
  );
  await db.query(
    "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id,metadata) VALUES($1,$2,$3,'subscription.changed',$3,$4)",
    [
      randomUUID(),
      staffId,
      organizationId,
      JSON.stringify({ plan, source, reason, expiresAt }),
    ],
  );
  await db.query(
    "UPDATE upgrade_requests SET status='RESOLVED' WHERE organization_id=$1 AND status='PENDING'",
    [organizationId],
  );
}
export async function changeOrganizationPlan(id: string, body: unknown) {
  const actor = await requireAdmin("billing");
  z.uuid().parse(id);
  const v = z
    .object({
      plan: planCode,
      source: subscriptionSource,
      reason: z.string().trim().min(3).max(1000),
      expiresAt: z.iso.datetime().nullable().default(null),
      duration: z
        .enum([
          "KEEP",
          "DAYS_14",
          "MONTHLY",
          "QUARTERLY",
          "YEARLY",
          "CUSTOM",
          "UNLIMITED",
        ])
        .optional(),
    })
    .strict()
    .parse(body);
  if (
    (v.source === "NUBRA_BASIC_BUNDLE" && v.plan !== "LITE") ||
    (v.source === "NUBRA_ENTERPRISE_BUNDLE" && v.plan !== "ENTERPRISE")
  )
    throw new HttpError(400, "El plan no corresponde al paquete");
  if (v.expiresAt && new Date(v.expiresAt) <= new Date())
    throw new HttpError(400, "La fecha debe ser futura");
  if (v.duration === "CUSTOM" && !v.expiresAt)
    throw new HttpError(400, "Elegí la fecha de vencimiento");
  if (v.duration && v.duration !== "CUSTOM" && v.expiresAt)
    throw new HttpError(400, "Elegí una duración o una fecha personalizada");
  return transaction(async (db) => {
    if (
      !(
        await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows.length
    )
      throw new HttpError(404, "Empresa no encontrada");
    let expiresAt = v.expiresAt;
    const now = new Date();
    if (v.duration === "KEEP") {
      const current = (
        await db.query<{ expires_at: Date | null }>(
          "SELECT expires_at FROM subscriptions WHERE organization_id=$1",
          [id],
        )
      ).rows[0];
      expiresAt = current?.expires_at?.toISOString() ?? null;
    } else if (v.duration === "UNLIMITED") expiresAt = null;
    else if (v.duration === "DAYS_14")
      expiresAt = new Date(now.getTime() + 14 * 86400000).toISOString();
    else if (
      v.duration &&
      ["MONTHLY", "QUARTERLY", "YEARLY"].includes(v.duration)
    )
      expiresAt = periodEnd(
        now,
        v.duration as "MONTHLY" | "QUARTERLY" | "YEARLY",
      ).toISOString();
    await setSubscription(
      db,
      id,
      v.plan,
      v.source,
      actor.id,
      v.reason,
      expiresAt,
    );
    return { id };
  });
}
export const grantSubscription = changeOrganizationPlan;
export async function revokeSubscription(id: string, reason: string) {
  return changeOrganizationPlan(id, {
    plan: "FREE",
    source: "MANUAL_GRANT",
    reason,
  });
}
export async function requestUpgrade(body: unknown) {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(403, "Permisos insuficientes");
  const v = z.object({ plan: planCode }).strict().parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const r = await db.query(
      `INSERT INTO upgrade_requests(organization_id,user_id,requested_plan) VALUES($1,$2,$3)
   ON CONFLICT(organization_id) WHERE status='PENDING' DO UPDATE SET requested_plan=EXCLUDED.requested_plan RETURNING id`,
      [ctx.organizationId, ctx.userId, v.plan],
    );
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'subscription.upgrade_requested','subscription',$4)",
      [randomUUID(), ctx.organizationId, ctx.userId, r.rows[0].id],
    );
    return {
      message:
        "Solicitud comercial registrada. NUBRA revisará el cambio de plan.",
    };
  });
}
