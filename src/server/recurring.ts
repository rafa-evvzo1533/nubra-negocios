import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getUserSession, allowAuthAttempt } from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { readJson } from "./http";
import {
  billingReady,
  MercadoPagoProvider,
  verifyMercadoPagoSignature,
} from "./mercado-pago";
import { RecurringProvider, type agreementSchema } from "./recurring-provider";
import { reconcilePayment } from "./checkout";

type Agreement = {
  id: string;
  organization_id: string;
  user_id: string;
  plan_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider_id: string | null;
  checkout_url: string | null;
};
async function responsible() {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión con un negocio aprobado");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(
      403,
      "Solo los responsables pueden administrar los cobros",
    );
  return ctx;
}
function validateProvider(
  local: Agreement,
  remote: z.infer<typeof agreementSchema>,
) {
  if (
    remote.external_reference !== local.id ||
    remote.collector_id !== process.env.MP_COLLECTOR_ID ||
    (local.provider_id && remote.id !== local.provider_id) ||
    remote.auto_recurring.frequency !== 1 ||
    remote.auto_recurring.frequency_type !== "months" ||
    remote.auto_recurring.currency_id !== local.currency ||
    Math.abs(
      remote.auto_recurring.transaction_amount * 100 - local.amount_cents,
    ) > 0.001
  )
    throw new HttpError(
      400,
      "La suscripción no coincide con el negocio, importe o vendedor configurado",
    );
}
export async function createRecurring(body: unknown) {
  const ctx = await responsible();
  const v = z
    .object({
      plan: z.enum(["LITE", "BUSINESS", "ENTERPRISE"]),
      idempotencyKey: z.uuid(),
      automaticRenewal: z.literal(true),
    })
    .strict()
    .parse(body);
  if (!billingReady())
    throw new HttpError(503, "Los pagos online todavía no están habilitados.");
  if (!(await allowAuthAttempt("recurring:" + ctx.userId, 15)))
    throw new HttpError(429, "Esperá unos minutos antes de volver a intentar");
  const local = await transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const existing = (
      await db.query<Agreement & { code: string; idempotency_key: string }>(
        "SELECT a.*,p.code FROM billing_agreements a JOIN plans p ON p.id=a.plan_id WHERE a.organization_id=$1 AND (a.status<>'CANCELLED' OR a.idempotency_key=$2) ORDER BY a.created_at DESC LIMIT 1",
        [ctx.organizationId, v.idempotencyKey],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.idempotency_key === v.idempotencyKey &&
        existing.code === v.plan &&
        existing.status === "PENDING" &&
        existing.checkout_url
      )
        return existing;
      throw new HttpError(
        409,
        "Ya hay una suscripción mensual. Revisala o cancelala antes de contratar otra.",
      );
    }
    const pending = await db.query(
      "SELECT id FROM billing_orders WHERE organization_id=$1 AND (status='REVIEW' OR (status IN ('CREATING','PENDING') AND created_at>NOW()-INTERVAL '24 hours'))",
      [ctx.organizationId],
    );
    if (pending.rows.length)
      throw new HttpError(
        409,
        "Resolvé el pago pendiente antes de suscribirte",
      );
    const current = (
      await db.query(
        "SELECT s.source,s.expires_at,p.code FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
        [ctx.organizationId],
      )
    ).rows[0];
    if (
      current &&
      current.code !== "FREE" &&
      current.source !== "BUSINESS_TRIAL" &&
      (!current.expires_at || new Date(String(current.expires_at)) > new Date())
    )
      throw new HttpError(
        409,
        "Tu plan está vigente. Podés activar la renovación mensual al finalizarlo.",
      );
    const plan = (
      await db.query<{ id: string; price_cents: number; currency: string }>(
        "SELECT id,price_cents,currency FROM plans WHERE code=$1 AND checkout_enabled AND price_cents>0",
        [v.plan],
      )
    ).rows[0];
    if (!plan)
      throw new HttpError(
        409,
        "Este plan todavía no está habilitado para pago online",
      );
    return (
      await db.query<Agreement>(
        "INSERT INTO billing_agreements(organization_id,user_id,plan_id,amount_cents,currency,idempotency_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          ctx.organizationId,
          ctx.userId,
          plan.id,
          plan.price_cents,
          plan.currency,
          v.idempotencyKey,
        ],
      )
    ).rows[0];
  });
  if (local.checkout_url) return { id: local.id, url: local.checkout_url };
  try {
    const remote = await new RecurringProvider().create({
      id: local.id,
      name: "Nubra Negocios " + v.plan,
      amount: local.amount_cents,
      currency: local.currency,
      email: ctx.email,
    });
    validateProvider(local, remote);
    await postgres.query(
      "UPDATE billing_agreements SET provider_id=$2,checkout_url=$3,status='PENDING',updated_at=NOW() WHERE id=$1 AND status='CREATING'",
      [local.id, remote.id, remote.url],
    );
    await postgres.query(
      "INSERT INTO platform_audit_logs(id,organization_id,user_id,action,resource_id) VALUES($1,$2,$3,'billing.recurring_consent',$4)",
      [randomUUID(), ctx.organizationId, ctx.userId, local.id],
    );
    return { id: local.id, url: remote.url };
  } catch (error) {
    await postgres.query(
      "UPDATE billing_agreements SET status='REVIEW',updated_at=NOW() WHERE id=$1 AND status='CREATING'",
      [local.id],
    );
    throw error;
  }
}
export async function synchronizeAgreement(local: Agreement) {
  if (!local.provider_id) return;
  const remote = await new RecurringProvider().get(local.provider_id);
  validateProvider(local, remote);
  await postgres.query(
    "UPDATE billing_agreements SET status=$2,next_payment_at=$3,updated_at=NOW() WHERE id=$1 AND status<>'CANCELLED'",
    [local.id, remote.status.toUpperCase(), remote.next_payment_date ?? null],
  );
}
export async function reconcileInvoice(id: string) {
  const provider = new RecurringProvider();
  const invoice = await provider.invoice(id);
  const local = (
    await postgres.query<Agreement>(
      "SELECT * FROM billing_agreements WHERE provider_id=$1",
      [invoice.preapproval_id],
    )
  ).rows[0];
  if (!local) return { received: true };
  const remote = await provider.get(invoice.preapproval_id);
  validateProvider(local, remote);
  if (
    invoice.currency_id !== local.currency ||
    Math.abs(invoice.transaction_amount * 100 - local.amount_cents) > 0.001 ||
    (invoice.external_reference != null &&
      String(invoice.external_reference) !== local.id)
  )
    throw new HttpError(400, "La factura no coincide con la suscripción");
  if (!invoice.payment) return { received: true };
  const payment = await new MercadoPagoProvider().payment(invoice.payment.id);
  if (
    payment.external_reference !== local.id ||
    payment.collector_id !== process.env.MP_COLLECTOR_ID ||
    payment.live_mode !== (process.env.MP_MODE === "live") ||
    payment.currency_id !== local.currency ||
    Math.abs(payment.transaction_amount * 100 - local.amount_cents) > 0.001
  )
    throw new HttpError(400, "El pago no coincide con la suscripción");
  const order = await transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      local.organization_id,
    ]);
    const previous = (
      await db.query<{ id: string }>(
        "SELECT id FROM billing_orders WHERE invoice_id=$1",
        [invoice.id],
      )
    ).rows[0];
    if (previous) return previous;
    return (
      await db.query<{ id: string }>(
        "INSERT INTO billing_orders(organization_id,user_id,plan_id,amount_cents,currency,idempotency_key,billing_period,status,agreement_id,invoice_id) VALUES($1,$2,$3,$4,$5,$6,'MONTHLY','PENDING',$7,$8) RETURNING id",
        [
          local.organization_id,
          local.user_id,
          local.plan_id,
          local.amount_cents,
          local.currency,
          randomUUID(),
          local.id,
          invoice.id,
        ],
      )
    ).rows[0];
  });
  // Only verified provider invoice/payment linkage can map an agreement to an order.
  await reconcilePayment({ ...payment, external_reference: order.id });
  await synchronizeAgreement(local);
  return { received: true };
}
export async function manageRecurring(body: unknown) {
  const ctx = await responsible();
  const v = z
    .object({ id: z.uuid(), action: z.enum(["cancel", "sync"]) })
    .strict()
    .parse(body);
  const local = (
    await postgres.query<Agreement>(
      "SELECT * FROM billing_agreements WHERE id=$1 AND organization_id=$2",
      [v.id, ctx.organizationId],
    )
  ).rows[0];
  if (!local) throw new HttpError(404, "Suscripción no encontrada");
  if (!(await allowAuthAttempt("recurring-manage:" + ctx.userId, 30)))
    throw new HttpError(429, "Esperá antes de volver a consultar");
  if (!local.provider_id)
    throw new HttpError(
      409,
      "La creación requiere revisión de NUBRA para evitar cobros duplicados",
    );
  const provider = new RecurringProvider();
  if (v.action === "cancel") {
    if (local.status === "CANCELLED")
      return { message: "La renovación ya está cancelada." };
    const current = await provider.get(local.provider_id);
    validateProvider(local, current);
    const remote =
      current.status === "cancelled"
        ? current
        : await provider.cancel(local.provider_id);
    validateProvider(local, remote);
    if (remote.status !== "cancelled")
      throw new HttpError(
        502,
        "Mercado Pago todavía no confirmó la cancelación",
      );
    await postgres.query(
      "UPDATE billing_agreements SET status='CANCELLED',next_payment_at=NULL,updated_at=NOW() WHERE id=$1",
      [local.id],
    );
    await postgres.query(
      "INSERT INTO platform_audit_logs(id,organization_id,user_id,action,resource_id) VALUES($1,$2,$3,'billing.recurring_cancelled',$4)",
      [randomUUID(), ctx.organizationId, ctx.userId, local.id],
    );
    return {
      message:
        "Renovación cancelada. Conservás el acceso hasta finalizar el período pagado.",
    };
  }
  await synchronizeAgreement(local);
  for (const invoice of await provider.invoices(local.provider_id))
    await reconcileInvoice(invoice.id);
  return { message: "Estado de la suscripción actualizado." };
}
export async function recurringWebhook(request: Request) {
  if (!billingReady()) throw new HttpError(503, "Pagos no configurados");
  const query = new URL(request.url).searchParams;
  const id = query.get("data.id") ?? "";
  if (
    !verifyMercadoPagoSignature(
      request.headers.get("x-signature"),
      request.headers.get("x-request-id"),
      id,
      process.env.MP_WEBHOOK_SECRET!,
    )
  )
    throw new HttpError(401, "Firma inválida");
  const body = await readJson(request);
  const event = z
    .object({ type: z.string().optional() })
    .passthrough()
    .parse(body);
  const type = query.get("type") ?? event.type;
  if (type === "subscription_authorized_payment") return reconcileInvoice(id);
  if (type === "subscription_preapproval") {
    const local = (
      await postgres.query<Agreement>(
        "SELECT * FROM billing_agreements WHERE provider_id=$1",
        [id],
      )
    ).rows[0];
    if (local) await synchronizeAgreement(local);
    return { received: true };
  }
  throw new HttpError(400, "Tipo de notificación no admitido");
}
