import { requirePermission } from "@/server/rbac";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorize } from "@/server/business";
import { consumeUsage } from "@/server/subscriptions";
import { transaction, audit } from "@/server/transactions";
import { endpoint, HttpError } from "@/server/http";
import { encodeCsv } from "@/domain/csv";
const queries = {
  customers:
    "SELECT name,email,phone,status FROM customers WHERE organization_id=$1 ORDER BY id LIMIT 10001",
  products:
    "SELECT name,sku,price_cents,stock,minimum_stock FROM products WHERE organization_id=$1 ORDER BY id LIMIT 10001",
  sales:
    "SELECT id,total_cents,status,created_at FROM sales WHERE organization_id=$1 ORDER BY id LIMIT 10001",
  inventory:
    "SELECT product_id,quantity,reason,previous_quantity,new_quantity,created_at FROM inventory_movements WHERE organization_id=$1 ORDER BY id LIMIT 10001",
};
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  let csv = "";
  const result = await endpoint(async () => {
    const resource = z
      .enum(["customers", "products", "sales", "inventory"])
      .parse((await params).resource);
    const ctx = await authorize(resource);
    await requirePermission(ctx, "data.export");
    await transaction(async (db) => {
      await consumeUsage(db, ctx, "csv_exports");
      const rows = (await db.query(queries[resource], [ctx.organizationId]))
        .rows;
      if (rows.length > 10000)
        throw new HttpError(
          409,
          "Esta exportación supera las 10.000 filas. Solicitá una exportación asistida.",
        );
      csv = encodeCsv(rows);
      await audit(db, ctx, `${resource}.exported`, randomUUID(), resource);
    });
    return { ok: true };
  });
  if (!result.ok) return result;
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nubra-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
