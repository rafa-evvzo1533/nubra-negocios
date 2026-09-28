import { Pool } from "pg";
import type { PoolClient } from "pg";
import { databaseContext } from "./request-context";
const globalForPostgres = globalThis as unknown as {
  pool?: Pool;
  schemaReady?: Promise<void>;
};
const pool =
  globalForPostgres.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL });
globalForPostgres.pool = pool;
async function initializeContext(db: PoolClient) {
  await db.query("SET LOCAL ROLE nubra_runtime");
  const c = databaseContext();
  await db.query(
    "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.support_grant_id',$3,true),set_config('app.staff_id',$4,true)",
    [
      c.organizationId ?? "",
      c.userId ?? "",
      c.supportGrantId ?? "",
      c.staffId ?? "",
    ],
  );
}
export const postgres = {
  async query<T = Record<string, unknown>>(sql: string, values?: unknown[]) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await initializeContext(db);
      const result = await db.query<T>(sql, values);
      await db.query("COMMIT");
      return result;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  },
  async connect(): Promise<PoolClient> {
    const db = await pool.connect();
    let started = false;
    return {
      async query<T = Record<string, unknown>>(
        sql: string,
        values?: unknown[],
      ) {
        if (sql === "BEGIN") {
          const r = await db.query<T>(sql);
          await initializeContext(db);
          started = true;
          return r;
        }
        if (!started) throw new Error("Database transactions require BEGIN");
        return db.query<T>(sql, values);
      },
      release() {
        db.release();
      },
    };
  },
};
// Runtime credentials need DML only. Migrations run explicitly before deployment.
export function ensureFoundationSchema() {
  return (globalForPostgres.schemaReady ??= postgres
    .query(
      "SELECT version FROM schema_migrations WHERE version='0010_commerce.sql'",
    )
    .then((result) => {
      if (!result.rows.length)
        throw new Error("Run npm run migrate before starting the application");
    })
    .catch((error) => {
      globalForPostgres.schemaReady = undefined;
      throw error;
    }));
}
