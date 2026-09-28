import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { authorize } from "./business";
import { postgres } from "./postgres";
import { transaction, audit } from "./transactions";
import {consumeUsage} from "./subscriptions";
import { HttpError } from "./http";
const input = z
  .object({
    image: z.string().max(4000000),
    totalCents: z.number().int().positive().max(1000000000000),
    description: z.string().trim().min(3).max(500),
    reference: z.string().trim().min(1).max(160),
    soldOn: z.iso.date(),
    confirmed: z.literal(true),
  })
  .strict();
export async function importReceipt(body: unknown) {
  const ctx = await authorize("sales", true);
  const v = input.parse(body);
  const image = Buffer.from(v.image, "base64");
  if (
    image.length < 50 ||
    image.length > 3000000 ||
    image.toString("base64") !== v.image
  )
    throw new HttpError(400, "Imagen inválida o demasiado grande");
  const mime = image.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    ? "image/jpeg"
    : image
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : null;
  if (!mime) throw new HttpError(400, "Usá una foto JPEG o PNG");
  const hash = createHash("sha256").update(image).digest("hex");
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const existing = (
      await db.query(
        `SELECT r.sale_id FROM receipt_imports r JOIN sales s ON s.organization_id=r.organization_id AND s.id=r.sale_id WHERE r.organization_id=$1 AND (r.image_hash=$2 OR s.source_reference=$3)`,
        [ctx.organizationId, hash, v.reference.toUpperCase()],
      )
    ).rows[0];
    if (existing) return { id: existing.sale_id, duplicate: true };
    const future = (
      await db.query(
        "SELECT $2::date > (NOW() AT TIME ZONE timezone)::date AS future FROM organizations WHERE id=$1",
        [ctx.organizationId, v.soldOn],
      )
    ).rows[0].future;
    if (future) throw new HttpError(400, "La fecha no puede ser futura");
    await consumeUsage(db,ctx,"monthly_sales");
    const id = randomUUID();
    await db.query(
      `INSERT INTO sales(id,organization_id,total_cents,source,source_reference,created_at) SELECT $2,$1,$3,'RECEIPT',$4,($5::date+TIME '12:00') AT TIME ZONE timezone FROM organizations WHERE id=$1`,
      [
        ctx.organizationId,
        id,
        v.totalCents,
        v.reference.toUpperCase(),
        v.soldOn,
      ],
    );
    await db.query(
      "INSERT INTO receipt_imports(id,organization_id,sale_id,image_hash,image_data,mime_type,description) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), ctx.organizationId, id, hash, image, mime, v.description],
    );
    await audit(db, ctx, "sales.imported_from_receipt", id, "sales");
    return { id, duplicate: false };
  });
}
export async function receiptImage(id: string) {
  const ctx = await authorize("sales");
  z.uuid().parse(id);
  const row = (
    await postgres.query(
      "SELECT image_data,mime_type FROM receipt_imports WHERE organization_id=$1 AND sale_id=$2",
      [ctx.organizationId, id],
    )
  ).rows[0];
  if (!row) throw new HttpError(404, "Comprobante no encontrado");
  await postgres.query(
    "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'FILE_DOWNLOADED','receipt',$4)",
    [randomUUID(), ctx.organizationId, ctx.userId, id],
  );
  return row;
}
