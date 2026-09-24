import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorize } from "./business";
import { transaction, audit } from "./transactions";
import { HttpError } from "./http";
export async function cancelSale(id: string) {
  const ctx = await authorize("sales", true);
  z.uuid().parse(id);
  if (!["OWNER", "ADMINISTRATOR", "ADMIN", "MANAGER"].includes(ctx.role))
    throw new HttpError(403, "No tenés permiso para cancelar ventas");
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const sale = (
      await db.query(
        "SELECT status FROM sales WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [ctx.organizationId, id],
      )
    ).rows[0];
    if (!sale) throw new HttpError(404, "Venta no encontrada");
    if (sale.status === "CANCELLED") return { id, status: "CANCELLED" };
    if (
      (
        await db.query(
          "SELECT id FROM payments WHERE organization_id=$1 AND sale_id=$2 LIMIT 1",
          [ctx.organizationId, id],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "La venta tiene cobros. Requiere un proceso de devolución.",
      );
    const items = (
      await db.query<{ product_id: string; quantity: number }>(
        "SELECT product_id,quantity FROM sale_items WHERE organization_id=$1 AND sale_id=$2 ORDER BY product_id",
        [ctx.organizationId, id],
      )
    ).rows;
    for (const item of items) {
      await db.query(
        "UPDATE products SET stock=stock+$3 WHERE organization_id=$1 AND id=$2",
        [ctx.organizationId, item.product_id, item.quantity],
      );
      await db.query(
        `INSERT INTO inventory_movements(id,organization_id,product_id,quantity,reason,previous_quantity,new_quantity,user_id,reference_id) SELECT $1,$2,$3,$4,$5,stock-$4,stock,$6,$7 FROM products WHERE organization_id=$2 AND id=$3`,
        [
          randomUUID(),
          ctx.organizationId,
          item.product_id,
          item.quantity,
          `Cancelación ${id}`,
          ctx.userId,
          id,
        ],
      );
    }
    await db.query(
      "UPDATE sales SET status='CANCELLED' WHERE organization_id=$1 AND id=$2",
      [ctx.organizationId, id],
    );
    await audit(db, ctx, "sales.cancelled", id, "sales");
    return { id, status: "CANCELLED" };
  });
}
