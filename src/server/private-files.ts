import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authorize } from "./business";
import { hashToken, allowAuthAttempt } from "./auth";
import { postgres } from "./postgres";
import { receiptImage } from "./receipts";
import { HttpError } from "./http";
function sign(value: string) {
  const key = process.env.FILE_SIGNING_SECRET || process.env.SESSION_SECRET;
  if (!key || key.length < 32)
    throw new HttpError(503, "Acceso temporal a archivos no configurado");
  return createHmac("sha256", key).update(value).digest("hex");
}
export async function createFileLink(saleId: string) {
  const ctx = await authorize("sales");
  z.uuid().parse(saleId);
  if (!(await allowAuthAttempt("file-link:" + ctx.userId, 30)))
    throw new HttpError(429, "Demasiadas solicitudes");
  const row = (
    await postgres.query(
      "SELECT id FROM receipt_imports WHERE organization_id=$1 AND sale_id=$2",
      [ctx.organizationId, saleId],
    )
  ).rows[0];
  if (!row) throw new HttpError(404, "Archivo no encontrado");
  const token = randomBytes(32).toString("hex"),
    signature = sign(token),
    expires = new Date(Date.now() + 300000);
  await postgres.query(
    "INSERT INTO private_file_links(organization_id,user_id,receipt_id,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)",
    [ctx.organizationId, ctx.userId, saleId, hashToken(token), expires],
  );
  return {
    url: "/api/v1/files/download?token=" + token + "&signature=" + signature,
    expiresAt: expires,
  };
}
export async function downloadFile(url: URL) {
  const ctx = await authorize("sales");
  const token = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(url.searchParams.get("token"));
  const signature = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(url.searchParams.get("signature"));
  if (
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(sign(token), "hex"),
    )
  )
    throw new HttpError(403, "Enlace inválido");
  const row = (
    await postgres.query(
      "SELECT receipt_id FROM private_file_links WHERE organization_id=$1 AND user_id=$2 AND token_hash=$3 AND expires_at>NOW()",
      [ctx.organizationId, ctx.userId, hashToken(token)],
    )
  ).rows[0];
  if (!row) throw new HttpError(403, "El enlace venció o no te pertenece");
  const image = await receiptImage(String(row.receipt_id));
  return image;
}
