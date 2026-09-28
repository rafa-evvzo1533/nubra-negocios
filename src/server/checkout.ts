import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getUserSession, allowAuthAttempt } from "./auth";
import { requireAdmin } from "./admin";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { planCode } from "./subscriptions";
import {
  billingReady,
  MercadoPagoProvider,
  verifyMercadoPagoSignature,
  type VerifiedPayment,
} from "./mercado-pago";
export async function configurePrice(body: unknown) {
  const actor = await requireAdmin("billing");
  const v = z
    .object({
      plan: planCode.exclude(["FREE"]),
      priceCents: z.number().int().positive().max(100000000).nullable(),
      currency: z.literal("ARS"),
      enabled: z.boolean(),
    })
    .strict()
    .parse(body);
  if (v.enabled && !v.priceCents)
    throw new HttpError(400, "Cargá un precio antes de habilitar el pago");
  return transaction(async (db) => {
    await db.query(
      "UPDATE plans SET price_cents=$2,currency=$3,checkout_enabled=$4,updated_at=NOW() WHERE code=$1",
      [v.plan, v.priceCents, v.currency, v.enabled],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,staff_id,action,metadata) VALUES($1,$2,'billing.price_changed',$3)",
      [randomUUID(), actor.id, JSON.stringify(v)],
    );
    return { updated: true };
  });
}
export async function checkout(body: unknown) {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión con un negocio aprobado");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(403, "Solo los responsables pueden contratar el plan");
  const v = z
    .object({ plan: planCode.exclude(["FREE"]), idempotencyKey: z.uuid() })
    .strict()
    .parse(body);
  if (!billingReady())
    throw new HttpError(503, "Los pagos online todavía no están habilitados.");
  if (!(await allowAuthAttempt("checkout:" + ctx.userId, 15)))
    throw new HttpError(429, "Demasiados intentos de pago");
  const order = await transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const prior = (
      await db.query<{
        id: string;
        code: string;
        status: string;
        checkout_url: string | null;
        updated_at: Date;
      }>(
        `SELECT o.*,p.code FROM billing_orders o JOIN plans p ON p.id=o.plan_id WHERE o.organization_id=$1 AND o.idempotency_key=$2 FOR UPDATE OF o`,
        [ctx.organizationId, v.idempotencyKey],
      )
    ).rows[0];
    if (prior) {
      if (prior.code !== v.plan)
        throw new HttpError(
          409,
          "La solicitud de pago ya corresponde a otro plan",
        );
      if (prior.status === "PAID")
        throw new HttpError(409, "Este pago ya fue acreditado");
      if (
        prior.status === "PENDING" &&
        Date.now() - new Date(prior.updated_at).getTime() < 24 * 3600000 &&
        prior.checkout_url
      )
        return { existing: prior.checkout_url, id: prior.id };
      throw new HttpError(
        409,
        "El pago se está preparando o requiere revisión. Consultá el historial antes de iniciar otro.",
      );
    }
    // A pending payment blocks a second checkout until it has expired.
    if (
      (
        await db.query(
          "SELECT id FROM billing_orders WHERE organization_id=$1 AND (status='REVIEW' OR (status IN ('CREATING','PENDING') AND created_at>NOW()-INTERVAL '24 hours')) LIMIT 1",
          [ctx.organizationId],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "Ya hay un pago pendiente. Continuá desde el historial.",
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
      (current.code !== v.plan || current.source !== "DIRECT_PURCHASE") &&
      (!current.expires_at || new Date(String(current.expires_at)) > new Date())
    )
      throw new HttpError(
        409,
        "Para cambiar un plan activo, solicitá una propuesta. Evitamos cobrarte dos planes superpuestos.",
      );
    const plan = (
      await db.query<{
        id: string;
        name: string;
        price_cents: number;
        currency: string;
      }>(
        "SELECT id,name,price_cents,currency FROM plans WHERE code=$1 AND checkout_enabled AND price_cents>0",
        [v.plan],
      )
    ).rows[0];
    if (!plan)
      throw new HttpError(
        409,
        "Este plan todavía no está disponible para pago online",
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO billing_orders(id,organization_id,user_id,plan_id,amount_cents,currency,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        ctx.organizationId,
        ctx.userId,
        plan.id,
        plan.price_cents,
        plan.currency,
        v.idempotencyKey,
      ],
    );
    return { id, plan };
  });
  if ("existing" in order) return { url: order.existing, id: order.id };
  // No long database transaction across a network call. Failed/uncertain creation remains non-payable locally.
  try {
    const provider = new MercadoPagoProvider();
    const result = await provider.createCheckout({
      id: order.id,
      name: order.plan.name,
      amount: order.plan.price_cents,
      currency: order.plan.currency,
      email: ctx.email,
    });
    await postgres.query(
      "UPDATE billing_orders SET preference_id=$2,checkout_url=$3,status='PENDING',updated_at=NOW() WHERE id=$1 AND status='CREATING'",
      [order.id, result.reference, result.url],
    );
    return { url: result.url, id: order.id };
  } catch (error) {
    await postgres.query(
      "UPDATE billing_orders SET status='REVIEW',updated_at=NOW() WHERE id=$1 AND status='CREATING'",
      [order.id],
    );
    throw error;
  }
}
export async function reconcilePayment(payment: VerifiedPayment) {
  if (
    payment.collector_id !== process.env.MP_COLLECTOR_ID ||
    payment.live_mode !== (process.env.MP_MODE === "live")
  )
    throw new HttpError(
      400,
      "El pago no pertenece al comercio o ambiente configurado",
    );
  const reference = z.uuid().safeParse(payment.external_reference);
  if (!reference.success) return { received: true };
  return transaction(async (db) => {
    const ref = (
      await db.query<{ organization_id: string }>(
        "SELECT organization_id FROM billing_orders WHERE id=$1",
        [reference.data],
      )
    ).rows[0];
    if (!ref) return { received: true };
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ref.organization_id,
    ]);
    const order = (
      await db.query<{
        id: string;
        organization_id: string;
        user_id: string;
        plan_id: string;
        code: string;
        amount_cents: number;
        currency: string;
        status: string;
        payment_id: string | null;
        paid_at: Date | null;
      }>(
        `SELECT o.*,p.code FROM billing_orders o JOIN plans p ON p.id=o.plan_id WHERE o.id=$1 FOR UPDATE OF o`,
        [reference.data],
      )
    ).rows[0];
    const amount = payment.transaction_amount * 100;
    if (
      !Number.isSafeInteger(Math.round(amount)) ||
      Math.abs(amount - order.amount_cents) > 0.001 ||
      payment.currency_id !== order.currency
    )
      throw new HttpError(
        400,
        "El importe o la moneda no coincide con el pedido",
      );
    if (order.payment_id && order.payment_id !== payment.id) {
      await db.query(
        "INSERT INTO platform_audit_logs(id,organization_id,action,resource_id) VALUES($1,$2,'billing.duplicate_payment_review',$3)",
        [randomUUID(), order.organization_id, order.id],
      );
      return { received: true };
    }
    const state =
      payment.transaction_amount_refunded > 0 ? "refunded" : payment.status;
    const event = await db.query(
      "INSERT INTO billing_events(payment_id,provider_status,order_id) VALUES($1,$2,$3) ON CONFLICT(payment_id,provider_status) DO NOTHING RETURNING id",
      [payment.id, state, order.id],
    );
    if (!event.rows.length) return { received: true };
    if (state === "approved" && !order.paid_at && order.status !== "REFUNDED") {
      const current = (
        await db.query<{
          code: string;
          source: string;
          expires_at: Date | null;
        }>(
          `SELECT p.code,s.source,s.expires_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1`,
          [order.organization_id],
        )
      ).rows[0];
      if (
        current &&
        current.code !== "FREE" &&
        (current.code !== order.code || current.source !== "DIRECT_PURCHASE") &&
        (!current.expires_at || current.expires_at > new Date())
      ) {
        await db.query(
          "UPDATE billing_orders SET status='REVIEW',payment_id=$2,updated_at=NOW() WHERE id=$1",
          [order.id, payment.id],
        );
        return { received: true };
      }
      const start =
        current?.code === order.code &&
        current.expires_at &&
        current.expires_at > new Date()
          ? current.expires_at
          : new Date();
      const end = new Date(start.getTime() + 30 * 86400000);
      await db.query(
        "UPDATE billing_orders SET status='PAID',payment_id=$2,paid_at=NOW(),period_end=$3,updated_at=NOW() WHERE id=$1",
        [order.id, payment.id, end],
      );
      await db.query(
        "UPDATE subscriptions SET plan_id=$2,source='DIRECT_PURCHASE',status='ACTIVE',expires_at=$3,billing_order_id=$4,updated_at=NOW() WHERE organization_id=$1",
        [order.organization_id, order.plan_id, end, order.id],
      );
      await db.query(
        "INSERT INTO subscription_history(organization_id,previous_plan,plan,source,reason) VALUES($1,$2,$3,'DIRECT_PURCHASE',$4)",
        [
          order.organization_id,
          current?.code ?? null,
          order.code,
          "Pago Mercado Pago " + payment.id,
        ],
      );
      await db.query(
        "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'subscription.paid','billing',$4)",
        [randomUUID(), order.organization_id, order.user_id, order.id],
      );
    } else if (["refunded", "charged_back", "cancelled"].includes(state)) {
      await db.query(
        "UPDATE billing_orders SET status='REFUNDED',payment_id=$2,updated_at=NOW() WHERE id=$1",
        [order.id, payment.id],
      );
      const changed = await db.query(
        "UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='FREE'),source='FREE_REGISTRATION',expires_at=NULL,billing_order_id=NULL,updated_at=NOW() WHERE organization_id=$1 AND billing_order_id=$2 RETURNING id",
        [order.organization_id, order.id],
      );
      if (changed.rows.length)
        await db.query(
          "INSERT INTO subscription_history(organization_id,previous_plan,plan,source,reason) VALUES($1,$2,'FREE','DIRECT_PURCHASE','Pago devuelto o revertido')",
          [order.organization_id, order.code],
        );
    } else if (state === "rejected" && !order.paid_at)
      await db.query(
        "UPDATE billing_orders SET status='FAILED',updated_at=NOW() WHERE id=$1",
        [order.id],
      );
    await db.query(
      "INSERT INTO platform_audit_logs(id,organization_id,action,resource_id,metadata) VALUES($1,$2,'billing.reconciled',$3,$4)",
      [
        randomUUID(),
        order.organization_id,
        order.id,
        JSON.stringify({ paymentId: payment.id, status: state }),
      ],
    );
    return { received: true };
  });
}
export async function receivePaymentWebhook(request: Request) {
  if (!billingReady()) throw new HttpError(503, "Pagos no configurados");
  const id = new URL(request.url).searchParams.get("data.id") ?? "";
  if (
    !verifyMercadoPagoSignature(
      request.headers.get("x-signature"),
      request.headers.get("x-request-id"),
      id,
      process.env.MP_WEBHOOK_SECRET!,
    )
  )
    throw new HttpError(401, "Firma inválida");
  return reconcilePayment(await new MercadoPagoProvider().payment(id));
}
export async function billingHistory() {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(403, "Permisos insuficientes");
  return (
    await postgres.query(
      `SELECT o.id,p.name,o.amount_cents,o.currency,o.status,o.created_at,o.paid_at,o.period_end,CASE WHEN o.status='PENDING' AND o.created_at>NOW()-INTERVAL '24 hours' THEN o.checkout_url END AS checkout_url FROM billing_orders o JOIN plans p ON p.id=o.plan_id WHERE o.organization_id=$1 ORDER BY o.created_at DESC LIMIT 50`,
      [ctx.organizationId],
    )
  ).rows;
}

// The browser can request verification, but only the provider decides payment status.
export async function reconcileCheckout(body: unknown) {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  if (!["OWNER", "ADMINISTRATOR", "ADMIN"].includes(ctx.role))
    throw new HttpError(403, "Permisos insuficientes");
  const v = z
    .object({ orderId: z.uuid(), paymentId: z.string().regex(/^\d{1,30}$/) })
    .strict()
    .parse(body);
  const order = (
    await postgres.query(
      "SELECT id FROM billing_orders WHERE id=$1 AND organization_id=$2",
      [v.orderId, ctx.organizationId],
    )
  ).rows[0];
  if (!order) throw new HttpError(404, "Pedido no encontrado");
  if (!(await allowAuthAttempt("reconcile:" + ctx.userId, 30)))
    throw new HttpError(429, "Esperá unos minutos antes de volver a consultar");
  const payment = await new MercadoPagoProvider().payment(v.paymentId);
  if (payment.external_reference !== v.orderId)
    throw new HttpError(400, "El pago no corresponde a este pedido");
  await reconcilePayment(payment);
  return { verified: true };
}
