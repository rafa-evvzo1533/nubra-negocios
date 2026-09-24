import { randomUUID, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  allowAuthAttempt,
  hashToken,
  verifyPassword,
  ADMIN_COOKIE,
} from "@/server/auth";
import { postgres } from "@/server/postgres";
import { transaction } from "@/server/transactions";
import { endpoint, HttpError } from "@/server/http";
export async function POST(request: Request) {
  return endpoint(async () => {
    const v = z
      .object({
        username: z.string().trim().min(1).max(320),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(await request.json());
    if (!(await allowAuthAttempt(`staff:${v.username.toLowerCase()}`)))
      throw new HttpError(429, "Demasiados intentos");
    const staff = (
      await postgres.query<{ id: string; password_hash: string }>(
        "SELECT id,password_hash FROM staff_users WHERE username=$1 AND active",
        [v.username.toLowerCase()],
      )
    ).rows[0];
    const valid = await verifyPassword(
      v.password,
      staff?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!staff || !valid)
      throw new HttpError(401, "Usuario o contraseña inválidos");
    const token = randomBytes(32).toString("hex");
    await transaction(async (db) => {
      await db.query(
        "INSERT INTO sessions(id,kind,staff_id,token_hash,expires_at) VALUES($1,'admin',$2,$3,NOW()+INTERVAL '8 hours')",
        [randomUUID(), staff.id, hashToken(token)],
      );
      await db.query(
        "INSERT INTO platform_audit_logs(id,staff_id,action) VALUES($1,$2,'auth.staff_login')",
        [randomUUID(), staff.id],
      );
    });
    (await cookies()).set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 28800,
    });
    return { authenticated: true };
  });
}
