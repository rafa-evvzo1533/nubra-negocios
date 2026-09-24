import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { postgres } from "./postgres";
import type { SessionContext } from "./tenant";
import type { Resource } from "./permissions";
import { HttpError } from "./http";

export async function transaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await postgres.connect();
  try {
    await db.query("BEGIN");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function audit(
  db: PoolClient,
  ctx: SessionContext,
  action: string,
  id: string,
  resource: Resource | "payments" | "cash" | "members",
) {
  await db.query(
    "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), ctx.organizationId, ctx.userId, action, resource, id],
  );
}

export type PricedItem = { productId: string; quantity: number; price: number };
export async function recordSale(
  db: PoolClient,
  ctx: SessionContext,
  id: string,
  customerId: string | null,
  items: PricedItem[],
) {
  let total = 0;
  for (const item of [...items].sort((a, b) =>
    a.productId.localeCompare(b.productId),
  )) {
    const result = await db.query(
      "UPDATE products SET stock=stock-$3 WHERE organization_id=$1 AND id=$2 AND stock >= $3 RETURNING id",
      [ctx.organizationId, item.productId, item.quantity],
    );
    if (!result.rows.length)
      throw new HttpError(409, "Producto no disponible o stock insuficiente");
    total += item.price * item.quantity;
    if (!Number.isSafeInteger(total))
      throw new HttpError(400, "Importe fuera de rango");
  }
  await db.query(
    "INSERT INTO sales(id,organization_id,customer_id,total_cents) VALUES($1,$2,$3,$4)",
    [id, ctx.organizationId, customerId, total],
  );
  for (const item of items) {
    await db.query(
      "INSERT INTO sale_items(id,organization_id,sale_id,product_id,quantity,price_cents) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        ctx.organizationId,
        id,
        item.productId,
        item.quantity,
        item.price,
      ],
    );
    await db.query(
      "INSERT INTO inventory_movements(id,organization_id,product_id,quantity,reason,previous_quantity,new_quantity,user_id,reference_id) SELECT $1,$2,$3,$4,$5,stock-$4,stock,$6,$7 FROM products WHERE organization_id=$2 AND id=$3",
      [
        randomUUID(),
        ctx.organizationId,
        item.productId,
        -item.quantity,
        `Venta ${id}`,
        ctx.userId,
        id,
      ],
    );
  }
}
