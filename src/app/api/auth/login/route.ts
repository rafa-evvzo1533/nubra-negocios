import { NextResponse } from "next/server";
import {
  allowAuthAttempt,
  createSession,
  USER_COOKIE,
  verifyPassword,
  dummyPasswordHash,
  hashPassword,
} from "@/server/auth";
import { ensureFoundationSchema, postgres } from "@/server/postgres";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) ?? {};
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.password.length > 200 ||
    body.email.length > 320
  )
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 },
    );
  const email = body.email.trim().toLowerCase();
  if (!(await allowAuthAttempt(`user:${email}`)))
    return NextResponse.json(
      { error: "Demasiados intentos. Probá nuevamente más tarde." },
      { status: 429 },
    );
  await ensureFoundationSchema();
  const result = await postgres.query(
    `SELECT u.id, u.password_hash FROM users u WHERE u.email = $1 LIMIT 1`,
    [email],
  );
  const user = result.rows[0] as
    { id: string; password_hash: string } | undefined;
  const validPassword = await verifyPassword(
    body.password,
    user?.password_hash ?? (await dummyPasswordHash()),
  );
  if (!user || !validPassword) {
    await postgres.query(
      "INSERT INTO platform_audit_logs(id,action) VALUES($1,'AUTH_LOGIN_FAILED')",
      [randomUUID()],
    );
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 },
    );
  }
  if (!user.password_hash.startsWith("$argon2id$"))
    await postgres.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
      user.id,
      await hashPassword(body.password),
    ]);
  const token = await createSession("user", user.id);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
