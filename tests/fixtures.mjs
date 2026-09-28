// Synthetic fixtures only: staff may no longer grant enterprise membership via HTTP.
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
export async function fixtureMember(db, organizationId, options) {
  if (!new URL(process.env.DATABASE_URL).pathname.startsWith("/nubra_test_"))
    throw new Error("Isolated database required");
  const v = options.body,
    id = randomUUID(),
    userId = randomUUID();
  await db.query(
    "INSERT INTO users(id,name,email,password_hash,email_verified_at) VALUES($1,$2,$3,$4,NOW())",
    [userId, v.name, v.email, await hash(v.password)],
  );
  await db.query(
    "INSERT INTO organization_members(id,organization_id,user_id,role) VALUES($1,$2,$3,$4)",
    [id, organizationId, userId, v.role],
  );
  return { data: { id } };
}
