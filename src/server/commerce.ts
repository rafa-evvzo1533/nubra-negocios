import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { postgres } from "./postgres";
import { getUserSession } from "./auth";
import { requirePermission } from "./rbac";
import { hasFeature, enforceCapacity } from "./subscriptions";
import {
  transaction,
  audit,
  recordSale,
  type PricedItem,
} from "./transactions";
import { recordPayment } from "./finance";
import { HttpError } from "./http";
import type { PoolClient } from "pg";
import type { SessionContext } from "./tenant";
export async function commerceAccess(
  permission: string,
  feature = "core_business",
) {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  await requirePermission(ctx, permission);
  if (!(await hasFeature(ctx, feature)))
    throw new HttpError(403, "Tu plan no habilita esta función");
  return ctx;
}
const supplierInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.union([z.email(), z.literal("")]).default(""),
    phone: z.string().max(40).default(""),
    category: z.string().max(80).default(""),
    notes: z.string().max(2000).default(""),
  })
  .strict();
export async function suppliers() {
  const ctx = await commerceAccess("suppliers.read");
  return (
    await postgres.query(
      "SELECT * FROM suppliers WHERE organization_id=$1 ORDER BY active DESC,name LIMIT 500",
      [ctx.organizationId],
    )
  ).rows;
}
export async function saveSupplier(
  body: unknown,
  id?: string,
  archive = false,
) {
  const ctx = await commerceAccess("suppliers.write");
  if (id) z.uuid().parse(id);
  const v = archive ? null : supplierInput.parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    if (
      id &&
      !(
        await db.query(
          "SELECT id FROM suppliers WHERE organization_id=$1 AND id=$2",
          [ctx.organizationId, id],
        )
      ).rows.length
    )
      throw new HttpError(404, "Proveedor no encontrado");
    const entity = id ?? randomUUID();
    if (archive)
      await db.query(
        "UPDATE suppliers SET active=FALSE WHERE organization_id=$1 AND id=$2",
        [ctx.organizationId, id],
      );
    else {
      if (!id) await enforceCapacity(db, ctx, "suppliers");
      await db.query(
        id
          ? "UPDATE suppliers SET name=$3,email=$4,phone=$5,category=$6,notes=$7 WHERE organization_id=$1 AND id=$2"
          : "INSERT INTO suppliers(organization_id,id,name,email,phone,category,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          ctx.organizationId,
          entity,
          v!.name,
          v!.email,
          v!.phone,
          v!.category,
          v!.notes,
        ],
      );
    }
    await audit(
      db,
      ctx,
      "suppliers." + (archive ? "archived" : id ? "updated" : "created"),
      entity,
      "suppliers",
    );
    return { id: entity };
  });
}
async function replay(
  db: PoolClient,
  ctx: SessionContext,
  key: string,
  kind: string,
  body: unknown,
) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
    ctx.organizationId,
  ]);
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const row = (
    await db.query(
      "SELECT kind,request_hash,result FROM commerce_requests WHERE organization_id=$1 AND idempotency_key=$2",
      [ctx.organizationId, key],
    )
  ).rows[0];
  if (row && (row.kind !== kind || row.request_hash !== hash))
    throw new HttpError(409, "Esta solicitud ya se usó con otros datos");
  return { hash, result: row?.result };
}
async function remember(
  db: PoolClient,
  ctx: SessionContext,
  key: string,
  kind: string,
  hash: string,
  result: unknown,
) {
  await db.query(
    "INSERT INTO commerce_requests(organization_id,idempotency_key,kind,request_hash,result) VALUES($1,$2,$3,$4,$5)",
    [ctx.organizationId, key, kind, hash, JSON.stringify(result)],
  );
  return result;
}
export async function pointOfSale(body: unknown) {
  const ctx = await commerceAccess("sales.write");
  const v = z
    .object({
      idempotencyKey: z.uuid(),
      customerId: z.uuid().nullable().default(null),
      items: z
        .array(
          z
            .object({
              productId: z.uuid(),
              quantity: z.number().int().min(1).max(1000000),
            })
            .strict(),
        )
        .min(1)
        .max(100),
      paidCents: z.number().int().min(0).max(1000000000000),
      method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
    })
    .strict()
    .parse(body);
  if (v.paidCents > 0) await requirePermission(ctx, "cash.write");
  return transaction(async (db) => {
    const r = await replay(db, ctx, v.idempotencyKey, "pos", v);
    if (r.result) return r.result;
    if (
      v.customerId &&
      !(
        await db.query(
          "SELECT id FROM customers WHERE organization_id=$1 AND id=$2 FOR KEY SHARE",
          [ctx.organizationId, v.customerId],
        )
      ).rows.length
    )
      throw new HttpError(404, "Cliente no encontrado");
    const quantities = new Map<string, number>();
    v.items.forEach((i) =>
      quantities.set(
        i.productId,
        (quantities.get(i.productId) ?? 0) + i.quantity,
      ),
    );
    const items: PricedItem[] = [];
    for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const p = (
        await db.query(
          "SELECT price_cents FROM products WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [ctx.organizationId, productId],
        )
      ).rows[0];
      if (!p) throw new HttpError(404, "Producto no encontrado");
      items.push({ productId, quantity, price: Number(p.price_cents) });
    }
    const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
    if (v.paidCents > total)
      throw new HttpError(400, "El cobro supera el total");
    if (v.paidCents < total && !v.customerId)
      throw new HttpError(
        400,
        "Elegí un cliente para dejar saldo en cuenta corriente",
      );
    const id = randomUUID();
    await recordSale(db, ctx, id, v.customerId, items);
    if (v.paidCents > 0)
      await recordPayment(db, ctx, {
        saleId: id,
        amountCents: v.paidCents,
        method: v.method,
        reference: "Punto de venta",
        idempotencyKey: v.idempotencyKey,
      });
    await audit(db, ctx, "sales.pos_created", id, "sales");
    return remember(db, ctx, v.idempotencyKey, "pos", r.hash, {
      id,
      totalCents: total,
      paidCents: v.paidCents,
      balanceCents: total - v.paidCents,
    });
  });
}
export async function accounts(customerId?: string) {
  const ctx = await commerceAccess("accounts.read", "accounts");
  if (customerId) z.uuid().parse(customerId);
  const summaries = (
    await postgres.query(
      `WITH totals AS(SELECT s.customer_id,SUM(s.total_cents) AS total,SUM(COALESCE(p.paid,0)) AS paid FROM sales s LEFT JOIN(SELECT sale_id,SUM(amount_cents) AS paid FROM payments WHERE organization_id=$1 GROUP BY sale_id)p ON p.sale_id=s.id WHERE s.organization_id=$1 AND s.status='CONFIRMED' GROUP BY s.customer_id) SELECT c.id,c.name,c.phone,COALESCE(t.total,0)::text AS total_cents,COALESCE(t.paid,0)::text AS paid_cents,(COALESCE(t.total,0)-COALESCE(t.paid,0))::text AS balance_cents FROM customers c LEFT JOIN totals t ON t.customer_id=c.id WHERE c.organization_id=$1 AND ($2::uuid IS NULL OR c.id=$2) ORDER BY (COALESCE(t.total,0)-COALESCE(t.paid,0)) DESC,c.name LIMIT 500`,
      [ctx.organizationId, customerId ?? null],
    )
  ).rows;
  if (customerId && !summaries.length)
    throw new HttpError(404, "Cliente no encontrado");
  const sales = customerId
    ? (
        await postgres.query(
          `SELECT s.id,s.created_at,s.total_cents::text,COALESCE(SUM(p.amount_cents),0)::text AS paid_cents,(s.total_cents-COALESCE(SUM(p.amount_cents),0))::text AS balance_cents FROM sales s LEFT JOIN payments p ON p.organization_id=s.organization_id AND p.sale_id=s.id WHERE s.organization_id=$1 AND s.customer_id=$2 AND s.status='CONFIRMED' GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200`,
          [ctx.organizationId, customerId],
        )
      ).rows
    : [];
  return { customers: summaries, sales };
}
export async function collectAccount(body: unknown) {
  const ctx = await commerceAccess("accounts.write", "accounts");
  await requirePermission(ctx, "cash.write");
  const v = z
    .object({
      customerId: z.uuid(),
      amountCents: z.number().int().positive().max(1000000000000),
      method: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]),
      idempotencyKey: z.uuid(),
    })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    const r = await replay(db, ctx, v.idempotencyKey, "collection", v);
    if (r.result) return r.result;
    const sales = (
      await db.query(
        `SELECT s.id,(s.total_cents-COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.organization_id=$1 AND p.sale_id=s.id),0))::text AS balance FROM sales s WHERE s.organization_id=$1 AND s.customer_id=$2 AND s.status='CONFIRMED' ORDER BY s.created_at,s.id FOR UPDATE`,
        [ctx.organizationId, v.customerId],
      )
    ).rows;
    const total = sales.reduce((n, s) => n + Number(s.balance), 0);
    if (v.amountCents > total)
      throw new HttpError(409, "El cobro supera el saldo pendiente");
    let remaining = v.amountCents;
    const payments = [];
    for (const sale of sales) {
      const amount = Math.min(remaining, Number(sale.balance));
      if (amount <= 0) continue;
      payments.push(
        await recordPayment(db, ctx, {
          saleId: String(sale.id),
          amountCents: amount,
          method: v.method,
          reference: "Cobro de cuenta corriente",
          idempotencyKey: randomUUID(),
        }),
      );
      remaining -= amount;
      if (!remaining) break;
    }
    return remember(db, ctx, v.idempotencyKey, "collection", r.hash, {
      payments,
      balanceCents: total - v.amountCents,
    });
  });
}
export async function reports(params: URLSearchParams) {
  const ctx = await commerceAccess("reports.read", "reports");
  await requirePermission(ctx, "finance.read");
  const range = z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .parse({ from: params.get("from"), to: params.get("to") });
  if (
    range.from > range.to ||
    (Date.parse(range.to) - Date.parse(range.from)) / 86400000 > 366
  )
    throw new HttpError(400, "Elegí un período de hasta 366 días");
  const args = [ctx.organizationId, range.from, range.to];
  const where =
    "s.organization_id=$1 AND s.status='CONFIRMED' AND (s.created_at AT TIME ZONE o.timezone)::date BETWEEN $2::date AND $3::date";
  const totals = (
    await postgres.query(
      `SELECT COUNT(*)::int AS sales,COALESCE(SUM(s.total_cents),0)::text AS total_cents FROM sales s JOIN organizations o ON o.id=s.organization_id WHERE ${where}`,
      args,
    )
  ).rows[0];
  const payments = (
    await postgres.query(
      "SELECT method,SUM(amount_cents)::text AS amount_cents FROM payments p JOIN organizations o ON o.id=p.organization_id WHERE p.organization_id=$1 AND (p.created_at AT TIME ZONE o.timezone)::date BETWEEN $2::date AND $3::date GROUP BY method",
      args,
    )
  ).rows;
  const products = (
    await postgres.query(
      `SELECT p.id,p.name,SUM(i.quantity)::int AS units,SUM(i.quantity*i.price_cents::bigint)::text AS revenue_cents,SUM(i.quantity*(i.price_cents::bigint-i.cost_cents))::text AS gross_margin_cents FROM sale_items i JOIN sales s ON s.id=i.sale_id AND s.organization_id=i.organization_id JOIN products p ON p.id=i.product_id AND p.organization_id=i.organization_id JOIN organizations o ON o.id=s.organization_id WHERE ${where} GROUP BY p.id,p.name ORDER BY SUM(i.quantity) DESC LIMIT 25`,
      args,
    )
  ).rows;
  return { range, totals, payments, products };
}
export async function businessAudit() {
  const ctx = await commerceAccess("audit.read");
  return (
    await postgres.query(
      "SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 200",
      [ctx.organizationId],
    )
  ).rows;
}
