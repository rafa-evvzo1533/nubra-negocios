import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SessionContext } from "./tenant";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { hashPassword } from "./auth";
import { HttpError } from "./http";
import { enforceCapacity } from "./subscriptions";
export const roles = z.enum([
  "OWNER",
  "ADMINISTRATOR",
  "MANAGER",
  "SALES",
  "SUPPORT",
  "OPERATIONS",
  "FINANCE",
  "CUSTOM",
  "CASHIER",
  "INVENTORY",
  "VIEWER",
  "ADMIN",
]);
export async function members(organizationId: string) {
  z.uuid().parse(organizationId);
  return (
    await postgres.query(
      "SELECT m.id,m.user_id,u.name,u.email,m.role,m.custom_role_id,r.name AS custom_role_name,m.created_at FROM organization_members m JOIN users u ON u.id=m.user_id LEFT JOIN organization_roles r ON r.organization_id=m.organization_id AND r.id=m.custom_role_id WHERE m.organization_id=$1 ORDER BY u.name,m.id",
      [organizationId],
    )
  ).rows;
}
export async function changeMember(
  organizationId: string,
  id: string,
  body: unknown,
  actor: SessionContext | null,
) {
  z.uuid().parse(organizationId);
  z.uuid().parse(id);
  const input =
    body === null
      ? null
      : z
          .object({ role: roles, customRoleId: z.uuid().nullable().optional() })
          .strict()
          .parse(body);
  const role = input?.role ?? null;
  const customRoleId = input?.customRoleId ?? null;
  if (role === "CUSTOM" && !customRoleId)
    throw new HttpError(400, "Seleccioná un rol propio");
  if (role !== "CUSTOM" && customRoleId)
    throw new HttpError(
      400,
      "El rol propio no corresponde al tipo seleccionado",
    );
  return transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      organizationId,
    ]);
    const target = (
      await db.query(
        "SELECT user_id,role FROM organization_members WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [organizationId, id],
      )
    ).rows[0];
    if (!target) throw new HttpError(404, "Miembro no encontrado");
    if (actor) {
      const current = (
        await db.query(
          "SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2",
          [organizationId, actor.userId],
        )
      ).rows[0];
      if (
        !current ||
        !["OWNER", "ADMINISTRATOR", "ADMIN"].includes(String(current.role))
      )
        throw new HttpError(403, "Permisos insuficientes");
      if (
        current.role !== "OWNER" &&
        (target.role === "OWNER" || role === "OWNER")
      )
        throw new HttpError(
          403,
          "Solo un propietario puede administrar propietarios",
        );
    }
    if (target.role === "OWNER" && role !== "OWNER") {
      const count = Number(
        (
          await db.query(
            "SELECT COUNT(*) AS count FROM organization_members WHERE organization_id=$1 AND role='OWNER'",
            [organizationId],
          )
        ).rows[0].count,
      );
      if (count <= 1)
        throw new HttpError(
          409,
          "La empresa debe conservar al menos un propietario",
        );
    }
    if (
      customRoleId &&
      !(
        await db.query(
          "SELECT id FROM organization_roles WHERE organization_id=$1 AND id=$2",
          [organizationId, customRoleId],
        )
      ).rows.length
    )
      throw new HttpError(404, "Rol no encontrado en este negocio");
    if (role)
      await db.query(
        "UPDATE organization_members SET role=$3,custom_role_id=$4 WHERE organization_id=$1 AND id=$2",
        [organizationId, id, role, customRoleId],
      );
    else
      await db.query(
        "DELETE FROM organization_members WHERE organization_id=$1 AND id=$2",
        [organizationId, id],
      );
    await db.query(
      "DELETE FROM sessions WHERE organization_id=$1 AND user_id=$2",
      [organizationId, target.user_id],
    );
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        organizationId,
        actor?.userId ?? null,
        role ? "members.role_changed" : "members.removed",
        "members",
        id,
      ],
    );
    return { id };
  });
}
export async function addMember(organizationId: string, body: unknown) {
  z.uuid().parse(organizationId);
  const v = z
    .object({
      email: z
        .email()
        .max(320)
        .transform((v) => v.toLowerCase().trim()),
      name: z.string().trim().min(2).max(120),
      role: roles.exclude(["CUSTOM"]),
      password: z.string().min(12).max(200).optional(),
      existing: z.boolean().default(false),
    })
    .strict()
    .parse(body);
  if (!v.existing && !v.password)
    throw new HttpError(
      400,
      "Ingresá una contraseña inicial de al menos 12 caracteres",
    );
  const hash = v.existing ? null : await hashPassword(v.password!);
  return transaction(async (db) => {
    const org = await db.query(
      "SELECT id FROM organizations WHERE id=$1 FOR UPDATE",
      [organizationId],
    );
    if (!org.rows.length) throw new HttpError(404, "Empresa no encontrada");
    await enforceCapacity(
      db,
      { organizationId, userId: "internal", role: "OWNER" },
      "users",
    );
    const user = (
      await db.query("SELECT id FROM users WHERE email=$1", [v.email])
    ).rows[0];
    if (v.existing && !user)
      throw new HttpError(404, "La cuenta todavía no existe");
    if (!v.existing && user)
      throw new HttpError(
        409,
        "El email ya tiene una cuenta; usá vincular cuenta existente",
      );
    const userId = user?.id ?? randomUUID();
    if (!user)
      await db.query(
        "INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",
        [userId, v.name, v.email, hash],
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role) VALUES($1,$2,$3,$4)",
      [id, organizationId, userId, v.role],
    );
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,action,entity_type,entity_id) VALUES($1,$2,'members.added','members',$3)",
      [randomUUID(), organizationId, id],
    );
    return { id };
  });
}
