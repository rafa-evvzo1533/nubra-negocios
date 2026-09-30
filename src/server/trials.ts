import { randomUUID } from "node:crypto";
import { getUserSession } from "./auth";
import { HttpError } from "./http";
import { transaction } from "./transactions";

export async function claimBusinessTrial() {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión con un negocio aprobado");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(403, "Solo los responsables pueden activar la prueba");
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const current = (
      await db.query(
        "SELECT p.code,s.trial_claimed_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
        [ctx.organizationId],
      )
    ).rows[0];
    if (!current || current.code !== "FREE" || current.trial_claimed_at)
      throw new HttpError(
        409,
        "La prueba está disponible una sola vez para negocios en Free",
      );
    const pending = await db.query(
      "SELECT id FROM billing_agreements WHERE organization_id=$1 AND status<>'CANCELLED' UNION ALL SELECT id FROM billing_orders WHERE organization_id=$1 AND (status='REVIEW' OR (status IN ('CREATING','PENDING') AND created_at>NOW()-INTERVAL '24 hours'))",
      [ctx.organizationId],
    );
    if (pending.rows.length)
      throw new HttpError(
        409,
        "Resolvé la contratación pendiente antes de activar una prueba",
      );
    const result = await db.query(
      "UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='BUSINESS'),source='BUSINESS_TRIAL',status='ACTIVE',trial_claimed_at=NOW(),trial_ends_at=NOW()+INTERVAL '14 days',expires_at=NOW()+INTERVAL '14 days',billing_order_id=NULL,updated_at=NOW() WHERE organization_id=$1 RETURNING expires_at",
      [ctx.organizationId],
    );
    await db.query(
      "INSERT INTO subscription_history(organization_id,previous_plan,plan,source,reason) VALUES($1,'FREE','BUSINESS','BUSINESS_TRIAL','Prueba de 14 días reclamada por el negocio; sin renovación ni cobros')",
      [ctx.organizationId],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,organization_id,user_id,action) VALUES($1,$2,$3,'subscription.trial_claimed')",
      [randomUUID(), ctx.organizationId, ctx.userId],
    );
    return {
      message:
        "Activaste Business por 14 días. Después volvés a Free, sin cargos.",
      expiresAt: result.rows[0].expires_at,
    };
  });
}
