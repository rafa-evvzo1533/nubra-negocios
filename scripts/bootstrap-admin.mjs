import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import pg from "pg";
import * as argon2 from "argon2";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
let { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
const connection =
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const db = new pg.Pool({ connectionString: connection });
try {
  if (process.argv.includes("--generate-local")) {
    if (!["localhost", "127.0.0.1"].includes(new URL(connection).hostname))
      throw new Error("Automatic recovery is limited to a local database");
    ADMIN_USERNAME = ADMIN_USERNAME?.trim().toLowerCase() || "nubra-admin";
    ADMIN_PASSWORD = randomBytes(24).toString("base64url");
    let env = await readFile(".env", "utf8");
    for (const [key, value] of Object.entries({
      ADMIN_USERNAME,
      ADMIN_PASSWORD,
    })) {
      const line = key + '="' + value + '"';
      const re = new RegExp("^" + key + "=.*$", "m");
      env = re.test(env) ? env.replace(re, line) : env + "\n" + line + "\n";
    }
    await writeFile(".env", env);
    await mkdir(".local", { recursive: true });
    await writeFile(
      ".local/admin-access.txt",
      `Acceso local a NUBRA Internal\nURL: http://localhost:3000/admin\nUsuario: ${ADMIN_USERNAME}\nContraseña: ${ADMIN_PASSWORD}\n\nArchivo privado local. No compartir ni subir a Git.\n`,
      { mode: 0o600 },
    );
  }
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12)
    throw new Error(
      "Configure ADMIN_USERNAME and ADMIN_PASSWORD (12+ characters), or run npm run setup:admin -- --generate-local for local recovery.",
    );
  const reset =
    process.argv.includes("--reset") ||
    process.argv.includes("--generate-local");
  const hash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  await db.query(
    `INSERT INTO staff_users(id,username,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN') ON CONFLICT(username) ${reset ? "DO UPDATE SET password_hash=EXCLUDED.password_hash,active=true" : "DO NOTHING"}`,
    [randomUUID(), ADMIN_USERNAME.trim().toLowerCase(), hash],
  );
  if (reset)
    await db.query(
      "DELETE FROM sessions WHERE staff_id=(SELECT id FROM staff_users WHERE username=$1)",
      [ADMIN_USERNAME.trim().toLowerCase()],
    );
  console.log(
    reset
      ? "Admin access recovered. Local generated credentials: .local/admin-access.txt"
      : "Internal administrator ready; existing password unchanged.",
  );
} finally {
  await db.end();
}
