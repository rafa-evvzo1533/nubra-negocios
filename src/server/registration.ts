import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  allowAuthAttempt,
  getAccountSession,
  hashPassword,
  hashToken,
} from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { mailConfig, sendVerificationEmail } from "./mail";
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(320));
const generic = {
  message:
    "Si la cuenta necesita verificación, recibirá un enlace por correo. Luego iniciá sesión para continuar.",
};
async function deliverVerification(userId: string, email: string) {
  const token = randomBytes(32).toString("hex");
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
    await db.query(
      "UPDATE email_verification_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
      [userId],
    );
    await db.query(
      "INSERT INTO email_verification_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '24 hours')",
      [randomUUID(), userId, hashToken(token)],
    );
  });
  try {
    await sendVerificationEmail(email, token);
  } catch {
    await postgres.query(
      "DELETE FROM email_verification_tokens WHERE token_hash=$1",
      [hashToken(token)],
    );
    console.error("email.verification.delivery_failed");
  }
}
export async function registerAccount(body: unknown) {
  const v = z
    .object({
      name: z.string().trim().min(2).max(120),
      email: emailSchema,
      password: z.string().min(12).max(200),
    })
    .strict()
    .parse(body);
  // A configuration outage must not consume the visitor's registration attempts.
  mailConfig();
  if (
    !(await allowAuthAttempt(`register:${v.email}`, 3)) ||
    !(await allowAuthAttempt("register:global", 100))
  )
    throw new HttpError(429, "Demasiados intentos. Probá más tarde.");
  const passwordHash = await hashPassword(v.password);
  const inserted = await postgres.query<{ id: string }>(
    "INSERT INTO users(id,name,email,password_hash,registration_source) VALUES($1,$2,$3,$4,'PUBLIC') ON CONFLICT(email) DO NOTHING RETURNING id",
    [randomUUID(), v.name, v.email, passwordHash],
  );
  if (inserted.rows[0]) await deliverVerification(inserted.rows[0].id, v.email);
  return generic;
}
export async function resendVerification() {
  const account = await getAccountSession();
  if (!account) throw new HttpError(401, "Iniciá sesión");
  if (!(await allowAuthAttempt(`verify-resend:${account.id}`, 3)))
    throw new HttpError(429, "Demasiados intentos");
  mailConfig();
  if (!account.email_verified_at)
    await deliverVerification(account.id, account.email);
  return generic;
}
export async function verifyEmail(body: unknown) {
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    const row = (
      await db.query<{ user_id: string }>(
        `UPDATE email_verification_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() RETURNING user_id`,
        [hashToken(token)],
      )
    ).rows[0];
    if (!row) throw new HttpError(400, "El enlace es inválido o venció");
    await db.query(
      "UPDATE users SET email_verified_at=NOW(),updated_at=NOW() WHERE id=$1",
      [row.user_id],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,user_id,action) VALUES($1,$2,'auth.email_verified')",
      [randomUUID(), row.user_id],
    );
    return {
      message: "Email verificado. Iniciá sesión para presentar tu negocio.",
    };
  });
}
