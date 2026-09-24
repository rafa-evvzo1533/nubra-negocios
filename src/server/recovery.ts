import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { allowAuthAttempt, hashPassword, hashToken } from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { mailConfig, sendResetEmail } from "./mail";
export async function requestReset(body: unknown) {
  const { email } = z
    .object({
      email: z
        .email()
        .max(320)
        .transform((v) => v.trim().toLowerCase()),
    })
    .strict()
    .parse(body);
  if (!(await allowAuthAttempt(`reset:${email}`, 3)))
    throw new HttpError(429, "Demasiados intentos. Volvé a probar más tarde.");
  mailConfig();
  const user = (
    await postgres.query<{ id: string }>(
      "SELECT id FROM users WHERE email=$1",
      [email],
    )
  ).rows[0];
  if (user) {
    const token = randomBytes(32).toString("hex");
    await transaction(async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
      await db.query(
        "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
        [user.id],
      );
      await db.query(
        "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')",
        [randomUUID(), user.id, hashToken(token)],
      );
    });
    try {
      await sendResetEmail(email, token);
    } catch {
      await postgres.query(
        "DELETE FROM password_reset_tokens WHERE user_id=$1 AND token_hash=$2",
        [user.id, hashToken(token)],
      );
      console.error("password reset delivery failed");
    }
  }
  return {
    message:
      "Si el email pertenece a una cuenta, recibirá un enlace para recuperar el acceso.",
  };
}
export async function resetPassword(body: unknown) {
  const v = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      password: z.string().min(12).max(200),
    })
    .strict()
    .parse(body);
  if (!(await allowAuthAttempt(`reset-token:${hashToken(v.token)}`)))
    throw new HttpError(429, "Demasiados intentos");
  const tokenHash = hashToken(v.token);
  const token = (
    await postgres.query<{ user_id: string }>(
      "SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()",
      [tokenHash],
    )
  ).rows[0];
  if (!token) throw new HttpError(400, "El enlace es inválido o venció");
  const password = await hashPassword(v.password);
  await transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      token.user_id,
    ]);
    const valid = await db.query(
      "SELECT id FROM password_reset_tokens WHERE token_hash=$1 AND user_id=$2 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE",
      [tokenHash, token.user_id],
    );
    if (!valid.rows.length)
      throw new HttpError(400, "El enlace es inválido o venció");
    await db.query(
      "UPDATE users SET password_hash=$2,updated_at=NOW() WHERE id=$1",
      [token.user_id, password],
    );
    await db.query(
      "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
      [token.user_id],
    );
    await db.query("DELETE FROM sessions WHERE user_id=$1", [token.user_id]);
  });
  return { message: "Contraseña actualizada. Iniciá sesión nuevamente." };
}
