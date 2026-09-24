import { NextResponse } from "next/server";
import {
  allowAuthAttempt,
  createSession,
  USER_COOKIE,
  verifyPassword,
} from "@/server/auth";
import { ensureFoundationSchema, postgres } from "@/server/postgres";

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
    user?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (!user || !validPassword)
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 },
    );
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
