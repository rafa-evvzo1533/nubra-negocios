import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorize } from "./business";
import { postgres } from "./postgres";
import { transaction, audit } from "./transactions";
import { HttpError } from "./http";
const activityInput = z
  .object({
    kind: z.enum(["NOTE", "CALL", "MEETING", "EMAIL"]),
    description: z.string().trim().min(1).max(5000),
  })
  .strict();
export async function customerActivities(id: string, body?: unknown) {
  const ctx = await authorize("customers", body !== undefined);
  z.uuid().parse(id);
  const found = await postgres.query(
    "SELECT id FROM customers WHERE organization_id=$1 AND id=$2",
    [ctx.organizationId, id],
  );
  if (!found.rows.length) throw new HttpError(404, "Cliente no encontrado");
  if (body === undefined)
    return (
      await postgres.query(
        "SELECT id,kind,description,created_at FROM customer_activities WHERE organization_id=$1 AND customer_id=$2 ORDER BY created_at DESC,id LIMIT 100",
        [ctx.organizationId, id],
      )
    ).rows;
  const input = activityInput.parse(body);
  return transaction(async (db) => {
    const activityId = randomUUID();
    await db.query(
      "INSERT INTO customer_activities(id,organization_id,customer_id,user_id,kind,description) VALUES($1,$2,$3,$4,$5,$6)",
      [
        activityId,
        ctx.organizationId,
        id,
        ctx.userId,
        input.kind,
        input.description,
      ],
    );
    await audit(db, ctx, "customers.activity_added", id, "customers");
    return { id: activityId };
  });
}
