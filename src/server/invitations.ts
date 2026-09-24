import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOwner } from "./organization-roles";
import { getAccountSession, hashToken, allowAuthAttempt } from "./auth";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { enforceCapacity, getLimit } from "./subscriptions";
import { mailConfig, sendInvitationEmail } from "./mail";
import { HttpError } from "./http";
const invitationRole = z.enum([
  "ADMINISTRATOR",
  "MANAGER",
  "SALES",
  "SUPPORT",
  "OPERATIONS",
  "FINANCE",
  "CASHIER",
  "INVENTORY",
  "VIEWER",
  "CUSTOM",
]);
export async function invitations() {
  const ctx = await requireOwner();
  return (
    await postgres.query(
      `SELECT i.id,i.email,i.role,r.name AS role_name,i.expires_at FROM member_invitations i LEFT JOIN organization_roles r ON r.id=i.custom_role_id AND r.organization_id=i.organization_id WHERE i.organization_id=$1 AND i.status='PENDING' AND i.expires_at>NOW() ORDER BY i.created_at DESC`,
      [ctx.organizationId],
    )
  ).rows;
}
export async function invite(body: unknown) {
  const ctx = await requireOwner();
  const v = z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
      role: invitationRole,
      customRoleId: z.uuid().optional(),
    })
    .strict()
    .parse(body);
  if ((v.role === "CUSTOM") !== !!v.customRoleId)
    throw new HttpError(400, "Seleccioná un rol válido");
  mailConfig();
  if (!(await allowAuthAttempt("invite:" + ctx.userId, 15)))
    throw new HttpError(429, "Demasiadas invitaciones");
  const token = randomBytes(32).toString("hex"),
    id = randomUUID();
  await transaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
      ctx.organizationId,
    ]);
    await db.query(
      "UPDATE member_invitations SET status='REVOKED' WHERE organization_id=$1 AND status='PENDING' AND expires_at<=NOW()",
      [ctx.organizationId],
    );
    if (
      (
        await db.query(
          "SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.email=$2",
          [ctx.organizationId, v.email],
        )
      ).rows.length
    )
      throw new HttpError(409, "Esta persona ya pertenece al equipo");
    if (
      v.customRoleId &&
      !(
        await db.query(
          "SELECT id FROM organization_roles WHERE organization_id=$1 AND id=$2",
          [ctx.organizationId, v.customRoleId],
        )
      ).rows.length
    )
      throw new HttpError(404, "Rol no encontrado");
    const seats = Number(
      (
        await db.query(
          "SELECT (SELECT COUNT(*) FROM organization_members WHERE organization_id=$1)+(SELECT COUNT(*) FROM member_invitations WHERE organization_id=$1 AND status='PENDING' AND expires_at>NOW()) AS n",
          [ctx.organizationId],
        )
      ).rows[0].n,
    );
    if (seats >= (await getLimit(ctx, "users", db)))
      throw new HttpError(
        403,
        "No quedan lugares en tu plan. Revisá los miembros y las invitaciones pendientes.",
      );
    await db.query(
      "INSERT INTO member_invitations(id,organization_id,email,role,custom_role_id,invited_by,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '7 days')",
      [
        id,
        ctx.organizationId,
        v.email,
        v.role,
        v.customRoleId ?? null,
        ctx.userId,
        hashToken(token),
      ],
    );
  });
  try {
    await sendInvitationEmail(v.email, token);
  } catch {
    await postgres.query(
      "UPDATE member_invitations SET status='REVOKED' WHERE id=$1",
      [id],
    );
    throw new HttpError(
      503,
      "No se pudo enviar el correo. Podés volver a intentar.",
    );
  }
  return { id };
}
export async function revokeInvitation(id: string) {
  const ctx = await requireOwner();
  z.uuid().parse(id);
  if (
    !(
      await postgres.query(
        "UPDATE member_invitations SET status='REVOKED' WHERE organization_id=$1 AND id=$2 AND status='PENDING' RETURNING id",
        [ctx.organizationId, id],
      )
    ).rows.length
  )
    throw new HttpError(404, "Invitación no encontrada");
  return { revoked: true };
}
export async function acceptInvitation(body: unknown) {
  const account = await getAccountSession();
  if (!account)
    throw new HttpError(
      401,
      "Iniciá sesión con el email invitado y volvé a este enlace",
    );
  if (!account.email_verified_at)
    throw new HttpError(403, "Verificá tu email antes de aceptar");
  const v = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    const ref = (
      await db.query(
        "SELECT organization_id FROM member_invitations WHERE token_hash=$1",
        [hashToken(v.token)],
      )
    ).rows[0];
    if (!ref) throw new HttpError(400, "Invitación inválida o vencida");
    const org = (
      await db.query(
        "SELECT id FROM organizations WHERE id=$1 AND active AND status='APPROVED' FOR UPDATE",
        [ref.organization_id],
      )
    ).rows[0];
    if (!org) throw new HttpError(403, "El negocio no está disponible");
    const i = (
      await db.query(
        "SELECT * FROM member_invitations WHERE token_hash=$1 AND status='PENDING' AND expires_at>NOW() FOR UPDATE",
        [hashToken(v.token)],
      )
    ).rows[0];
    if (!i || i.email !== account.email)
      throw new HttpError(
        400,
        "Invitación inválida, vencida o dirigida a otro email",
      );
    if (
      !(
        await db.query(
          "SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role='OWNER'",
          [org.id, i.invited_by],
        )
      ).rows.length
    )
      throw new HttpError(409, "El propietario debe volver a invitarte");
    await db.query(
      "UPDATE member_invitations SET status='ACCEPTED' WHERE id=$1",
      [i.id],
    );
    await enforceCapacity(
      db,
      { organizationId: String(org.id), userId: account.id, role: "OWNER" },
      "users",
    );
    await db.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,custom_role_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), org.id, account.id, i.role, i.custom_role_id],
    );
    await db.query(
      "UPDATE member_invitations SET status='ACCEPTED' WHERE id=$1",
      [i.id],
    );
    await db.query(
      "INSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'members.invitation_accepted','members',$3)",
      [randomUUID(), org.id, account.id],
    );
    return {
      accepted: true,
      message:
        "Invitación aceptada. Iniciá sesión nuevamente para elegir este negocio.",
    };
  });
}
