import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import nextEnv from "@next/env";
import pg from "pg";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.MIGRATION_DATABASE_URL) {
  const runtimeCheck = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  let separated = false;
  try {
    const r = (
      await runtimeCheck.query(
        "SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND pg_has_role(current_user,'nubra_runtime','MEMBER') AS ready FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    separated = Boolean(r?.ready);
  } catch {
  } finally {
    await runtimeCheck.end();
  }
  if (separated) {
    console.log("Runtime credentials already separated.");
    process.exit(0);
  }
}
const ownerUrl = new URL(
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
);
if (!["localhost", "127.0.0.1"].includes(ownerUrl.hostname))
  throw new Error(
    "Provision remote runtime credentials through your infrastructure administrator",
  );
const db = new pg.Pool({ connectionString: ownerUrl.toString() });
try {
  const name =
      "nubra_web_" +
      createHash("sha256").update(ownerUrl.pathname).digest("hex").slice(0, 12),
    password = randomBytes(32).toString("hex");
  const exists = (
    await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [name])
  ).rows.length;
  await db.query(
    `${exists ? "ALTER" : "CREATE"} ROLE ${name} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`,
  );
  await db.query(`GRANT nubra_runtime TO ${name}`);
  const runtime = new URL(ownerUrl);
  runtime.username = name;
  runtime.password = password;
  let env = await readFile(".env", "utf8");
  env = env.replace(
    /^DATABASE_URL=.*$/m,
    'DATABASE_URL="' + runtime.toString() + '"',
  );
  if (!process.env.MIGRATION_DATABASE_URL)
    env += '\nMIGRATION_DATABASE_URL="' + ownerUrl.toString() + '"\n';
  await writeFile(".env", env);
  console.log(
    "Runtime login now uses least privilege. Migration credentials separated in local environment.",
  );
} finally {
  await db.end();
}
