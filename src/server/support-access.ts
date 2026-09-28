import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStaffSession, allowAuthAttempt } from "./auth";
import { requireOwner } from "./organization-roles";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { scopedContext } from "./request-context";
const scopes = z.enum(["customers.read", "inventory.read", "sales.read"]);
async function staff() {
  const s = await getStaffSession();
  if (!s) throw new HttpError(401, "Iniciá sesión como personal NUBRA");
  if (!["SUPER_ADMIN", "SUPPORT_ADMIN", "SECURITY_ADMIN"].includes(s.role))
    throw new HttpError(403, "Permisos de soporte insuficientes");
  return s;
}
export async function listSupport(internal = false) {
  const actor = internal ? await staff() : await requireOwner();
  await recordExpired(
    internal ? "staff_id" : "organization_id",
    internal
      ? (actor as { id: string }).id
      : (actor as { organizationId: string }).organizationId,
  );
  return (
    await postgres.query(
      `SELECT r.id,r.organization_id,o.name AS organization_name,r.staff_id,s.username,r.reason,r.scope,r.duration_minutes,CASE WHEN g.revoked_at IS NOT NULL THEN 'REVOKED' WHEN g.expires_at<=NOW() THEN 'EXPIRED' ELSE r.status END AS status,r.created_at,g.id AS grant_id,g.expires_at FROM support_access_requests r JOIN organizations o ON o.id=r.organization_id JOIN staff_users s ON s.id=r.staff_id LEFT JOIN support_access_grants g ON g.request_id=r.id WHERE ${internal ? "r.staff_id" : "r.organization_id"}=$1 ORDER BY r.created_at DESC LIMIT 100`,
      [
        internal
          ? (actor as { id: string }).id
          : (actor as { organizationId: string }).organizationId,
      ],
    )
  ).rows;
}
export async function requestSupport(body: unknown) {
  const actor = await staff();
  const v = z
    .object({
      organizationId: z.uuid(),
      reason: z.string().trim().min(15).max(1000),
      scope: z.array(scopes).min(1).max(3),
      durationMinutes: z.union([
        z.literal(15),
        z.literal(30),
        z.literal(60),
        z.literal(240),
      ]),
    })
    .strict()
    .parse(body);
  if (!(await allowAuthAttempt("support:" + actor.id, 15)))
    throw new HttpError(429, "Demasiadas solicitudes");
  return transaction(async (db) => {
    if (
      !(
        await db.query(
          "SELECT id FROM organizations WHERE id=$1 AND active AND status='APPROVED'",
          [v.organizationId],
        )
      ).rows.length
    )
      throw new HttpError(404, "Negocio no disponible");
    const id = randomUUID();
    await db.query(
      "INSERT INTO support_access_requests(id,organization_id,staff_id,reason,scope,duration_minutes) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        v.organizationId,
        actor.id,
        v.reason,
        [...new Set(v.scope)],
        v.durationMinutes,
      ],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id) VALUES($1,$2,$3,'SUPPORT_ACCESS_REQUESTED',$4)",
      [randomUUID(), actor.id, v.organizationId, id],
    );
    return { id };
  });
}
export async function decideSupport(id: string, body: unknown) {
  const ctx = await requireOwner();
  z.uuid().parse(id);
  const v = z
    .object({ action: z.enum(["APPROVE", "REJECT", "REVOKE"]) })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const r = (
      await db.query(
        "SELECT * FROM support_access_requests WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [ctx.organizationId, id],
      )
    ).rows[0];
    if (!r) throw new HttpError(404, "Solicitud no encontrada");
    if (v.action === "REVOKE") {
      if (r.status !== "APPROVED")
        throw new HttpError(409, "No hay acceso activo");
      await db.query(
        "UPDATE support_access_grants SET revoked_at=NOW() WHERE request_id=$1 AND organization_id=$2",
        [id, ctx.organizationId],
      );
    } else if (r.status !== "PENDING")
      throw new HttpError(409, "Esta solicitud ya fue resuelta");
    const status =
      v.action === "APPROVE"
        ? "APPROVED"
        : v.action === "REJECT"
          ? "REJECTED"
          : "REVOKED";
    await db.query(
      "UPDATE support_access_requests SET status=$3,approved_by=$4,decided_at=NOW() WHERE organization_id=$1 AND id=$2",
      [ctx.organizationId, id, status, ctx.userId],
    );
    if (v.action === "APPROVE")
      await db.query(
        "INSERT INTO support_access_grants(request_id,organization_id,staff_id,scope,approved_by,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+make_interval(mins=>$6))",
        [
          id,
          ctx.organizationId,
          r.staff_id,
          r.scope,
          ctx.userId,
          r.duration_minutes,
        ],
      );
    await db.query(
      "INSERT INTO platform_audit_logs(id,user_id,organization_id,action,resource_id) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        ctx.userId,
        ctx.organizationId,
        "SUPPORT_ACCESS_" + status,
        id,
      ],
    );
    return { status };
  });
}
export async function supportHistory() {
  const ctx = await requireOwner();
  return (
    await postgres.query(
      "SELECT a.id,a.action,a.created_at,a.metadata,s.username FROM platform_audit_logs a LEFT JOIN staff_users s ON s.id=a.staff_id WHERE a.organization_id=$1 AND a.action LIKE 'SUPPORT_%' ORDER BY a.created_at DESC LIMIT 100",
      [ctx.organizationId],
    )
  ).rows;
}
async function recordExpired(
  column: "staff_id" | "organization_id",
  id: string,
) {
  await postgres.query(
    `WITH expired AS(UPDATE support_access_grants SET expiry_recorded_at=NOW() WHERE ${column}=$1 AND expires_at<=NOW() AND revoked_at IS NULL AND expiry_recorded_at IS NULL RETURNING id,organization_id,staff_id) INSERT INTO platform_audit_logs(id,organization_id,staff_id,action,resource_id) SELECT gen_random_uuid(),organization_id,staff_id,'SUPPORT_ACCESS_EXPIRED',id FROM expired`,
    [id],
  );
}
export async function supportRead(grantId: string, resource: string) {
  const actor = await staff();
  z.uuid().parse(grantId);
  const resourceKey = z
    .enum(["customers", "inventory", "sales"])
    .safeParse(resource);
  if (!resourceKey.success)
    throw new HttpError(403, "El soporte no puede consultar este recurso");
  const grant = (
    await postgres.query(
      "SELECT * FROM support_access_grants WHERE id=$1 AND staff_id=$2",
      [grantId, actor.id],
    )
  ).rows[0];
  if (
    !grant ||
    grant.revoked_at ||
    new Date(String(grant.expires_at)) <= new Date() ||
    !(grant.scope as string[]).includes(resource + ".read")
  ) {
    await recordExpired("staff_id", actor.id);
    await postgres.query(
      "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id) VALUES($1,$2,$3,'SUPPORT_ACCESS_DENIED',$4)",
      [randomUUID(), actor.id, grant?.organization_id ?? null, grantId],
    );
    throw new HttpError(
      403,
      "El acceso no está autorizado, fue revocado o venció",
    );
  }
  return scopedContext(
    {
      organizationId: String(grant.organization_id),
      supportGrantId: grantId,
      staffId: actor.id,
    },
    () =>
      transaction(async (db) => {
        const queries = {
          customers:
            "SELECT id,name,status,created_at FROM customers WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50",
          inventory:
            "SELECT id,name,sku,stock,minimum_stock FROM products WHERE organization_id=$1 ORDER BY name LIMIT 50",
          sales:
            "SELECT id,status,source,created_at FROM sales WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50",
        };
        await db.query(
          "WITH started AS(UPDATE support_access_grants SET started_at=NOW() WHERE id=$1 AND started_at IS NULL RETURNING id,organization_id,staff_id) INSERT INTO platform_audit_logs(id,organization_id,staff_id,action,resource_id) SELECT gen_random_uuid(),organization_id,staff_id,'SUPPORT_ACCESS_STARTED',id FROM started",
          [grantId],
        );
        const data = (
          await db.query(queries[resourceKey.data], [grant.organization_id])
        ).rows;
        await db.query(
          "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id,metadata) VALUES($1,$2,$3,'SUPPORT_RESOURCE_ACCESSED',$4,$5)",
          [
            randomUUID(),
            actor.id,
            grant.organization_id,
            grantId,
            JSON.stringify({ resource, count: data.length }),
          ],
        );
        return {
          items: data,
          scope: resource + ".read",
          expiresAt: grant.expires_at,
        };
      }),
  );
}
