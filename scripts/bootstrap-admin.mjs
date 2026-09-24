import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12)
  throw new Error(
    "Configure ADMIN_USERNAME and ADMIN_PASSWORD (12+ characters)",
  );
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const salt = randomBytes(16).toString("hex");
  const hash = `${salt}:${scryptSync(ADMIN_PASSWORD, salt, 64).toString("hex")}`;
  await db.query(
    "INSERT INTO staff_users(id,username,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN') ON CONFLICT(username) DO NOTHING",
    [randomUUID(), ADMIN_USERNAME.toLowerCase(), hash],
  );
  console.log(
    "Internal administrator provisioned; existing passwords were not changed.",
  );
} finally {
  await db.end();
}
