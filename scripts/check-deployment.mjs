import nextEnv from "@next/env";
import pg from "pg";
import { readdir } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const problems = [];
if (process.env.MIGRATION_DATABASE_URL || process.env.ADMIN_PASSWORD)
  problems.push(
    "Remove migration/bootstrap secrets from the runtime environment.",
  );
try {
  const url = new URL(process.env.APP_URL);
  if (
    url.protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(url.hostname)
  )
    problems.push("APP_URL must be the public HTTPS origin.");
} catch {
  problems.push("APP_URL is missing or invalid.");
}
for (const key of ["SESSION_SECRET", "FILE_SIGNING_SECRET"])
  if (
    (process.env[key]?.length ?? 0) < 32 ||
    /replace|YOUR_/i.test(process.env[key] ?? "")
  )
    problems.push(
      key + " needs a private random value of at least 32 characters.",
    );
if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is required.");
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
  problems.push("TLS certificate verification cannot be disabled.");
try {
  const url = new URL(process.env.DATABASE_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const localVps = process.env.DEPLOYMENT_TARGET === "vps" && loopback;
  if (loopback && !localVps)
    problems.push("Use your external PostgreSQL host.");
  if (
    !localVps &&
    !["verify-full", "verify-ca"].includes(url.searchParams.get("sslmode"))
  )
    problems.push(
      "Use PostgreSQL sslmode=verify-full (or verify-ca with the provider CA).",
    );
} catch {
  problems.push("Invalid PostgreSQL URL.");
}
if (process.env.MAIL_ENABLED === "true")
  for (const key of ["SMTP_HOST", "SMTP_PORT", "MAIL_FROM"])
    if (!process.env[key]) problems.push(key + " is required for email.");
if (process.env.BILLING_ENABLED === "true")
  for (const key of ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET", "MP_COLLECTOR_ID"])
    if (!process.env[key]) problems.push(key + " is required for payments.");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    max: 1,
  });
  try {
    const role = (
      await pool.query(
        "SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,pg_has_role(current_user,'nubra_runtime','MEMBER') AS member FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (
      !role ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolinherit ||
      !role.member
    )
      throw new Error(
        "Runtime role must be restricted and a member of nubra_runtime.",
      );
    const latest = (await readdir("migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .at(-1);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE nubra_runtime");
      const r = await client.query(
        "SELECT version FROM schema_migrations WHERE version=$1",
        [latest],
      );
      if (!r.rows.length) throw new Error("Apply migrations before deploying.");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    console.log(
      "Deployment configuration, restricted PostgreSQL role and schema verified.",
    );
    if (process.env.BILLING_ENABLED !== "true")
      console.log("Online payments are disabled.");
    if (process.env.MAIL_ENABLED !== "true")
      console.log(
        "Email is disabled; registration/recovery cannot send messages.",
      );
  } catch (e) {
    console.error(
      e.message?.startsWith("Runtime role") ||
        e.message?.startsWith("Apply migrations")
        ? e.message
        : "PostgreSQL verification failed. Check TLS, connection, permissions and migrations.",
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
