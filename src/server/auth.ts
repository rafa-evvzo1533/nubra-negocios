import * as argon2 from "argon2";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { ensureFoundationSchema, postgres } from "@/server/postgres";
import type { SessionContext } from "@/server/tenant";
import { effectivePermissions } from "./rbac";
import { bindOrganization } from "./request-context";

const scrypt = promisify(nodeScrypt);
const ADMIN_COOKIE = "nubra_admin_session";
const USER_COOKIE = "nubra_user_session";

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith("$argon2id$")) {
    try {
      return await argon2.verify(stored, password);
    } catch {
      return false;
    }
  }
  const [salt, encoded] = stored.split(":");
  if (!salt || !encoded) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function allowAuthAttempt(key: string, limit = 10) {
  await ensureFoundationSchema();
  const result = await postgres.query<{ attempts: number }>(
    `INSERT INTO auth_rate_limits(key_hash,attempts,window_started_at) VALUES($1,1,NOW()) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE auth_rate_limits.attempts+1 END,window_started_at=CASE WHEN auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE auth_rate_limits.window_started_at END RETURNING attempts`,
    [hashToken(key)],
  );
  return result.rows[0].attempts <= limit;
}

export async function createSession(kind: "admin" | "user", userId?: string) {
  await ensureFoundationSchema();
  const token = randomBytes(32).toString("hex");
  await postgres.query(
    `WITH created AS (INSERT INTO sessions (id, user_id, kind, token_hash, expires_at, organization_id) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '8 hours', (SELECT m.organization_id FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$2 AND o.active AND o.status='APPROVED' ORDER BY m.created_at,m.id LIMIT 1)) RETURNING user_id) INSERT INTO platform_audit_logs(id,user_id,action) SELECT $5,user_id,'auth.login' FROM created`,
    [randomUUID(), userId ?? null, kind, hashToken(token), randomUUID()],
  );
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /Edg/.test(ua)
    ? "Microsoft Edge"
    : /Firefox/.test(ua)
      ? "Firefox"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "Navegador";
  await postgres.query(
    "UPDATE sessions SET device_label=$2 WHERE token_hash=$1",
    [hashToken(token), device],
  );
  return token;
}

export async function hasAdminSession() {
  return (await getStaffSession())?.role === "SUPER_ADMIN";
}

export async function getStaffSession() {
  await ensureFoundationSchema();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const result = await postgres.query<{
    id: string;
    role: string;
    username: string;
  }>(
    `SELECT a.id,a.role,a.username FROM sessions s JOIN staff_users a ON a.id=s.staff_id WHERE s.kind = 'admin' AND s.token_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL AND a.active`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

export async function getAccountSession() {
  await ensureFoundationSchema();
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  return (
    (
      await postgres.query<{
        id: string;
        name: string;
        email: string;
        email_verified_at: string | null;
      }>(
        `SELECT u.id,u.name,u.email,COALESCE(u.email_verified_at,CASE WHEN u.registration_source='ADMIN' THEN u.created_at END) AS email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.kind='user' AND s.token_hash=$1 AND s.expires_at>NOW() AND s.revoked_at IS NULL`,
        [hashToken(token)],
      )
    ).rows[0] ?? null
  );
}

export type UserSession = SessionContext & {
  sessionId: string;
  name: string;
  email: string;
  organizationName: string;
  currency: string;
};
export async function getUserSession(): Promise<UserSession | null> {
  await ensureFoundationSchema();
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const result = await postgres.query<UserSession>(
    `SELECT s.id AS "sessionId", u.id AS "userId", u.name, u.email, m.id AS "memberId", m.organization_id AS "organizationId", m.role, o.name AS "organizationName", o.currency FROM sessions s JOIN users u ON u.id = s.user_id JOIN organization_members m ON m.user_id = u.id AND m.organization_id=s.organization_id JOIN organizations o ON o.id=m.organization_id WHERE o.active AND o.status='APPROVED' AND (u.email_verified_at IS NOT NULL OR u.registration_source='ADMIN') AND s.kind = 'user' AND s.token_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL`,
    [hashToken(token)],
  );
  const session = result.rows[0];
  if (session) {
    bindOrganization(session);
    await postgres.query(
      "UPDATE sessions SET last_seen_at=NOW() WHERE id=$1 AND last_seen_at<NOW()-INTERVAL '1 minute'",
      [session.sessionId],
    );
  }
  return session
    ? { ...session, permissions: await effectivePermissions(session) }
    : null;
}

export { ADMIN_COOKIE, USER_COOKIE };

let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash() {
  return (dummyHash ??= hashPassword(randomBytes(32).toString("hex")));
}
