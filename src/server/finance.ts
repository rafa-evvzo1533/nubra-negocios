import type { PoolClient } from "pg";
import type { SessionContext } from "./tenant";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAccess } from "./access";
import { postgres } from "./postgres";
import { audit, transaction } from "./transactions";
import { requirePermission } from "./rbac";
import { HttpError } from "./http";
const amount = z.number().int().positive().max(1000000000000);
const paymentSchema = z
  .object({
    saleId: z.uuid(),
    amountCents: amount,
    method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
    reference: z.string().trim().max(160).default(""),
    idempotencyKey: z.uuid(),
  })
  .strict();
export async function financeSummary() {
  const ctx = await requireAccess("finance");
  if (ctx.role !== "CASHIER") await requirePermission(ctx, "finance.read");
  const org = [ctx.organizationId];
  const sales = (
    await postgres.query(
      `SELECT s.id,s.total_cents,s.source,s.created_at,c.name AS customer_name,COALESCE(p.paid,0)::text AS paid_cents,(s.total_cents-COALESCE(p.paid,0))::text AS balance_cents FROM sales s LEFT JOIN customers c ON c.organization_id=s.organization_id AND c.id=s.customer_id LEFT JOIN (SELECT sale_id,SUM(amount_cents) AS paid FROM payments WHERE organization_id=$1 GROUP BY sale_id) p ON p.sale_id=s.id WHERE s.organization_id=$1 AND s.status='CONFIRMED' ORDER BY s.created_at DESC,s.id LIMIT 100`,
      org,
    )
  ).rows;
  const payments = (
    await postgres.query(
      "SELECT id,sale_id,amount_cents,method,reference,created_at FROM payments WHERE organization_id=$1 ORDER BY created_at DESC,id LIMIT 100",
      org,
    )
  ).rows;
  const cash = (
    await postgres.query(
      `SELECT c.*, (c.opening_cents+COALESCE((SELECT SUM(m.amount_cents) FROM cash_movements m WHERE m.organization_id=c.organization_id AND m.cash_session_id=c.id),0))::text AS balance_cents FROM cash_sessions c WHERE c.organization_id=$1 ORDER BY c.opened_at DESC LIMIT 10`,
      org,
    )
  ).rows;
  const movements = (
    await postgres.query(
      "SELECT id,cash_session_id,amount_cents,reason,created_at FROM cash_movements WHERE organization_id=$1 ORDER BY created_at DESC,id LIMIT 100",
      org,
    )
  ).rows;
  return { sales, payments, cash, movements };
}
export async function registerPayment(body: unknown) {
  const ctx = await requireAccess("finance", true);
  const v = paymentSchema.parse(body);
  return transaction((db) => recordPayment(db, ctx, v));
}
export async function recordPayment(
  db: PoolClient,
  ctx: SessionContext,
  v: z.infer<typeof paymentSchema>,
) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.organizationId,
  ]);
  const prior = (
    await db.query(
      "SELECT id,sale_id,amount_cents,method,reference FROM payments WHERE organization_id=$1 AND idempotency_key=$2",
      [ctx.organizationId, v.idempotencyKey],
    )
  ).rows[0];
  if (prior) {
    if (
      prior.sale_id !== v.saleId ||
      Number(prior.amount_cents) !== v.amountCents ||
      prior.method !== v.method ||
      prior.reference !== v.reference
    )
      throw new HttpError(409, "La solicitud ya se usó con otros datos");
    return { id: prior.id };
  }
  const sale = (
    await db.query(
      "SELECT total_cents FROM sales WHERE organization_id=$1 AND id=$2 AND status='CONFIRMED' FOR UPDATE",
      [ctx.organizationId, v.saleId],
    )
  ).rows[0];
  if (!sale) throw new HttpError(404, "Venta no encontrada");
  const paid = Number(
    (
      await db.query(
        "SELECT COALESCE(SUM(amount_cents),0)::text AS total FROM payments WHERE organization_id=$1 AND sale_id=$2",
        [ctx.organizationId, v.saleId],
      )
    ).rows[0].total,
  );
  if (v.amountCents > Number(sale.total_cents) - paid)
    throw new HttpError(409, "El cobro supera el saldo pendiente");
  let cashId: string | null = null;
  if (v.method === "CASH") {
    const cash = (
      await db.query(
        "SELECT id FROM cash_sessions WHERE organization_id=$1 AND closed_at IS NULL FOR UPDATE",
        [ctx.organizationId],
      )
    ).rows[0];
    if (!cash)
      throw new HttpError(409, "Abrí una caja para registrar efectivo");
    cashId = String(cash.id);
  }
  const id = randomUUID();
  await db.query(
    "INSERT INTO payments(id,organization_id,sale_id,cash_session_id,amount_cents,method,reference,idempotency_key,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      id,
      ctx.organizationId,
      v.saleId,
      cashId,
      v.amountCents,
      v.method,
      v.reference,
      v.idempotencyKey,
      ctx.userId,
    ],
  );
  if (cashId)
    await db.query(
      "INSERT INTO cash_movements(id,organization_id,cash_session_id,payment_id,amount_cents,reason,idempotency_key,user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        ctx.organizationId,
        cashId,
        id,
        v.amountCents,
        `Cobro de venta ${v.saleId}`,
        v.idempotencyKey,
        ctx.userId,
      ],
    );
  await audit(db, ctx, "payments.created", id, "payments");
  return { id };
}

const cashInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("open"),
      openingCents: z.number().int().min(0).max(1000000000000),
    })
    .strict(),
  z
    .object({
      action: z.literal("close"),
      sessionId: z.uuid(),
      countedCents: z.number().int().min(0).max(1000000000000),
    })
    .strict(),
  z
    .object({
      action: z.literal("movement"),
      sessionId: z.uuid(),
      amountCents: z
        .number()
        .int()
        .min(-1000000000000)
        .max(1000000000000)
        .refine((v) => v !== 0),
      reason: z.string().trim().min(3).max(240),
      idempotencyKey: z.uuid(),
    })
    .strict(),
]);
export async function changeCash(body: unknown) {
  const ctx = await requireAccess("finance", true);
  const v = cashInput.parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    if (v.action === "open") {
      const open = await db.query(
        "SELECT id FROM cash_sessions WHERE organization_id=$1 AND closed_at IS NULL",
        [ctx.organizationId],
      );
      if (open.rows.length)
        throw new HttpError(409, "Ya existe una caja abierta");
      const id = randomUUID();
      await db.query(
        "INSERT INTO cash_sessions(id,organization_id,opening_cents,opened_by) VALUES($1,$2,$3,$4)",
        [id, ctx.organizationId, v.openingCents, ctx.userId],
      );
      await audit(db, ctx, "cash.opened", id, "cash");
      return { id };
    }
    const cash = (
      await db.query(
        "SELECT * FROM cash_sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [ctx.organizationId, v.sessionId],
      )
    ).rows[0];
    if (!cash) throw new HttpError(404, "Caja no encontrada");
    if (v.action === "movement") {
      const prior = (
        await db.query(
          "SELECT id,cash_session_id,amount_cents,reason FROM cash_movements WHERE organization_id=$1 AND idempotency_key=$2",
          [ctx.organizationId, v.idempotencyKey],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.cash_session_id !== v.sessionId ||
          Number(prior.amount_cents) !== v.amountCents ||
          prior.reason !== v.reason
        )
          throw new HttpError(409, "La solicitud ya se usó con otros datos");
        return { id: prior.id };
      }
    }
    if (cash.closed_at) {
      if (v.action === "close" && Number(cash.counted_cents) === v.countedCents)
        return { id: v.sessionId };
      throw new HttpError(409, "La caja está cerrada");
    }
    const movementTotal = Number(
      (
        await db.query(
          "SELECT COALESCE(SUM(amount_cents),0)::text AS total FROM cash_movements WHERE organization_id=$1 AND cash_session_id=$2",
          [ctx.organizationId, v.sessionId],
        )
      ).rows[0].total,
    );
    const expected = Number(cash.opening_cents) + movementTotal;
    if (v.action === "close") {
      await db.query(
        "UPDATE cash_sessions SET closed_at=NOW(),closed_by=$3,counted_cents=$4,expected_cents=$5 WHERE organization_id=$1 AND id=$2",
        [ctx.organizationId, v.sessionId, ctx.userId, v.countedCents, expected],
      );
      await audit(db, ctx, "cash.closed", v.sessionId, "cash");
      return { id: v.sessionId };
    }
    if (expected + v.amountCents < 0)
      throw new HttpError(409, "La salida supera el efectivo disponible");
    const id = randomUUID();
    await db.query(
      "INSERT INTO cash_movements(id,organization_id,cash_session_id,amount_cents,reason,idempotency_key,user_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        ctx.organizationId,
        v.sessionId,
        v.amountCents,
        v.reason,
        v.idempotencyKey,
        ctx.userId,
      ],
    );
    await audit(db, ctx, "cash.movement", id, "cash");
    return { id };
  });
}
