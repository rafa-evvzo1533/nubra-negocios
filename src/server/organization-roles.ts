import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getUserSession } from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
export async function requireOwner() {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  if (ctx.role !== "OWNER")
    throw new HttpError(
      403,
      "Solo el propietario puede administrar los roles del negocio",
    );
  return ctx;
}
export async function listOrganizationRoles() {
  const ctx = await requireOwner();
  return {
    roles: (
      await postgres.query(
        `SELECT r.id,r.name,r.description,COALESCE((SELECT json_agg(p.key ORDER BY p.key) FROM organization_role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.organization_id=r.organization_id AND rp.role_id=r.id),'[]') AS permissions,(SELECT COUNT(*)::int FROM organization_members m WHERE m.organization_id=r.organization_id AND m.custom_role_id=r.id) AS members FROM organization_roles r WHERE organization_id=$1 ORDER BY name`,
        [ctx.organizationId],
      )
    ).rows,
    permissions: (
      await postgres.query(
        "SELECT key FROM permissions WHERE key<>'members.write' ORDER BY key",
      )
    ).rows.map((p) => p.key),
  };
}
export async function saveOrganizationRole(body: unknown, id?: string) {
  const ctx = await requireOwner();
  if (id) z.uuid().parse(id);
  const v = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).default(""),
      permissions: z.array(z.string().max(80)).max(40),
    })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    const permissions = [...new Set(v.permissions)];
    // A custom operational role cannot change memberships or grant itself privileges.
    if (permissions.includes("members.write"))
      throw new HttpError(
        403,
        "La administración de accesos se reserva a los roles de sistema",
      );
    const allowed = (
      await db.query<{ id: string; key: string }>(
        "SELECT id,key FROM permissions WHERE key=ANY($1::text[])",
        [permissions],
      )
    ).rows;
    if (allowed.length !== permissions.length)
      throw new HttpError(400, "Permiso desconocido");
    for (const key of permissions)
      if (
        key.endsWith(".write") &&
        !permissions.includes(key.replace(".write", ".read"))
      )
        throw new HttpError(
          400,
          "Para editar también se necesita permiso de lectura",
        );
    let roleId = id;
    if (id) {
      if (
        !(
          await db.query(
            "UPDATE organization_roles SET name=$3,description=$4,updated_at=NOW() WHERE organization_id=$1 AND id=$2 RETURNING id",
            [ctx.organizationId, id, v.name, v.description],
          )
        ).rows.length
      )
        throw new HttpError(404, "Rol no encontrado");
    } else {
      const count = Number(
        (
          await db.query(
            "SELECT COUNT(*) AS n FROM organization_roles WHERE organization_id=$1",
            [ctx.organizationId],
          )
        ).rows[0].n,
      );
      if (count >= 100)
        throw new HttpError(409, "Máximo de 100 roles por negocio");
      roleId = randomUUID();
      await db.query(
        "INSERT INTO organization_roles(id,organization_id,name,description) VALUES($1,$2,$3,$4)",
        [roleId, ctx.organizationId, v.name, v.description],
      );
    }
    await db.query(
      "DELETE FROM organization_role_permissions WHERE organization_id=$1 AND role_id=$2",
      [ctx.organizationId, roleId],
    );
    for (const p of allowed)
      await db.query(
        "INSERT INTO organization_role_permissions(organization_id,role_id,permission_id) VALUES($1,$2,$3)",
        [ctx.organizationId, roleId, p.id],
      );
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,'roles',$5)",
      [
        randomUUID(),
        ctx.organizationId,
        ctx.userId,
        id ? "roles.updated" : "roles.created",
        roleId,
      ],
    );
    return { id: roleId };
  });
}
export async function deleteOrganizationRole(id: string) {
  const ctx = await requireOwner();
  z.uuid().parse(id);
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    if (
      (
        await db.query(
          "SELECT id FROM organization_members WHERE organization_id=$1 AND custom_role_id=$2 LIMIT 1",
          [ctx.organizationId, id],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "Reasigná a las personas antes de eliminar el rol",
      );
    if (
      (
        await db.query(
          "SELECT id FROM member_invitations WHERE organization_id=$1 AND custom_role_id=$2 AND status='PENDING' AND expires_at>NOW() LIMIT 1",
          [ctx.organizationId, id],
        )
      ).rows.length
    )
      throw new HttpError(
        409,
        "Revocá las invitaciones pendientes antes de eliminar el rol",
      );
    await db.query(
      "UPDATE member_invitations SET custom_role_id=NULL WHERE organization_id=$1 AND custom_role_id=$2",
      [ctx.organizationId, id],
    );
    if (
      !(
        await db.query(
          "DELETE FROM organization_roles WHERE organization_id=$1 AND id=$2 RETURNING id",
          [ctx.organizationId, id],
        )
      ).rows.length
    )
      throw new HttpError(404, "Rol no encontrado");
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'roles.deleted','roles',$4)",
      [randomUUID(), ctx.organizationId, ctx.userId, id],
    );
    return { id };
  });
}
