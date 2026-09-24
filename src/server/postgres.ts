import { Pool } from "pg";
const globalForPostgres = globalThis as unknown as {
  pool?: Pool;
  schemaReady?: Promise<void>;
};
export const postgres =
  globalForPostgres.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL });
globalForPostgres.pool = postgres;
// Runtime credentials need DML only. Migrations run explicitly before deployment.
export function ensureFoundationSchema() {
  return (globalForPostgres.schemaReady ??= postgres
    .query(
      "SELECT version FROM schema_migrations WHERE version='0006_invitations.sql'",
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
