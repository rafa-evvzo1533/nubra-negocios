import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorize, optionalDate, saleInput } from "./business";
import { transaction, audit, recordSale } from "./transactions";
import { HttpError } from "./http";

const quoteInput = saleInput
  .extend({
    validUntil: optionalDate,
    notes: z.string().trim().max(5000).default(""),
  })
  .strict();
export async function createQuote(body: unknown) {
  const ctx = await authorize("quotes", true);
  const input = quoteInput.parse(body);
  return transaction(async (db) => {
    if (input.customerId) {
      const customer = await db.query(
        "SELECT id FROM customers WHERE organization_id=$1 AND id=$2 FOR KEY SHARE",
        [ctx.organizationId, input.customerId],
      );
      if (!customer.rows.length)
        throw new HttpError(404, "Cliente no encontrado");
    }
    const id = randomUUID();
    const quantities = new Map<string, number>();
    input.items.forEach((item) =>
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      ),
    );
    const items: {
      productId: string;
      name: string;
      price: number;
      quantity: number;
    }[] = [];
    let total = 0;
    for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const result = await db.query<{ name: string; price_cents: number }>(
        "SELECT name,price_cents FROM products WHERE organization_id=$1 AND id=$2 FOR SHARE",
        [ctx.organizationId, productId],
      );
      if (!result.rows.length)
        throw new HttpError(404, "Producto no encontrado");
      const p = result.rows[0];
      total += p.price_cents * quantity;
      if (!Number.isSafeInteger(total))
        throw new HttpError(400, "Importe fuera de rango");
      items.push({ productId, name: p.name, price: p.price_cents, quantity });
    }
    await db.query(
      "INSERT INTO quotes(id,organization_id,customer_id,total_cents,valid_until,notes) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        ctx.organizationId,
        input.customerId ?? null,
        total,
        input.validUntil || null,
        input.notes,
      ],
    );
    for (const item of items)
      await db.query(
        "INSERT INTO quote_items(id,organization_id,quote_id,product_id,product_name,quantity,price_cents) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          ctx.organizationId,
          id,
          item.productId,
          item.name,
          item.quantity,
          item.price,
        ],
      );
    await audit(db, ctx, "quotes.created", id, "quotes");
    return { id };
  });
}
export async function updateQuote(id: string, body: unknown) {
  const ctx = await authorize("quotes", true);
  z.uuid().parse(id);
  const { status } = z
    .object({ status: z.enum(["SENT", "ACCEPTED", "REJECTED"]) })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    const result = await db.query<{ status: string; expired: boolean }>(
      `SELECT q.status, q.valid_until < (NOW() AT TIME ZONE o.timezone)::date AS expired FROM quotes q JOIN organizations o ON o.id=q.organization_id WHERE q.organization_id=$1 AND q.id=$2 FOR UPDATE OF q`,
      [ctx.organizationId, id],
    );
    const quote = result.rows[0];
    if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
    const transitions: Record<string, string[]> = {
      DRAFT: ["SENT", "REJECTED"],
      SENT: ["ACCEPTED", "REJECTED"],
      ACCEPTED: ["REJECTED"],
    };
    if (
      !transitions[quote.status]?.includes(status) ||
      (quote.expired && status !== "REJECTED")
    )
      throw new HttpError(
        409,
        "El presupuesto venció o el cambio de estado no está permitido",
      );
    await db.query(
      "UPDATE quotes SET status=$3 WHERE organization_id=$1 AND id=$2",
      [ctx.organizationId, id, status],
    );
    await audit(db, ctx, `quotes.${status.toLowerCase()}`, id, "quotes");
    return { id, status };
  });
}
export async function convertQuote(id: string) {
  const ctx = await authorize("quotes", true);
  await authorize("sales", true);
  z.uuid().parse(id);
  return transaction(async (db) => {
    const result = await db.query<{
      status: string;
      sale_id: string | null;
      customer_id: string | null;
      expired: boolean;
    }>(
      `SELECT q.status,q.sale_id,q.customer_id,q.valid_until < (NOW() AT TIME ZONE o.timezone)::date AS expired FROM quotes q JOIN organizations o ON o.id=q.organization_id WHERE q.organization_id=$1 AND q.id=$2 FOR UPDATE OF q`,
      [ctx.organizationId, id],
    );
    const quote = result.rows[0];
    if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
    if (quote.sale_id) return { id: quote.sale_id };
    if (quote.status !== "ACCEPTED" || quote.expired)
      throw new HttpError(409, "El presupuesto debe estar aceptado y vigente");
    const items = (
      await db.query<{
        product_id: string;
        quantity: number;
        price_cents: number;
      }>(
        "SELECT product_id,quantity,price_cents FROM quote_items WHERE organization_id=$1 AND quote_id=$2 ORDER BY product_id",
        [ctx.organizationId, id],
      )
    ).rows;
    const saleId = randomUUID();
    await recordSale(
      db,
      ctx,
      saleId,
      quote.customer_id,
      items.map((i) => ({
        productId: i.product_id,
        quantity: i.quantity,
        price: i.price_cents,
      })),
    );
    await db.query(
      "UPDATE quotes SET status='CONVERTED',sale_id=$3 WHERE organization_id=$1 AND id=$2",
      [ctx.organizationId, id, saleId],
    );
    await audit(db, ctx, "sales.created", saleId, "sales");
    await audit(db, ctx, "quotes.converted", id, "quotes");
    return { id: saleId };
  });
}
