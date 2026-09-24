import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(root, "migrations");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(71420931)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const applied = new Set((await client.query("SELECT version FROM schema_migrations")).rows.map((row) => row.version));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await client.query(await readFile(path.join(migrationsDir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [file]);
    console.log(`Applied ${file}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
