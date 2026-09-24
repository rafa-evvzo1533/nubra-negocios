import { postgres } from "./postgres";
import { HttpError } from "./http";
import type { SessionContext } from "./tenant";
export async function requirePermission(ctx: SessionContext, key: string) {
  const result = await postgres.query(
    `SELECT 1 FROM organization_members m JOIN permissions p ON p.key=$3 WHERE m.organization_id=$1 AND m.user_id=$2 AND (
      (m.role<>'CUSTOM' AND EXISTS(SELECT 1 FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE r.key=m.role AND rp.permission_id=p.id)) OR
      (m.role='CUSTOM' AND EXISTS(SELECT 1 FROM organization_role_permissions rp WHERE rp.organization_id=m.organization_id AND rp.role_id=m.custom_role_id AND rp.permission_id=p.id)))`,
    [ctx.organizationId, ctx.userId, key],
  );
  if (!result.rows.length) throw new HttpError(403, "Permisos insuficientes");
}
export async function effectivePermissions(ctx: SessionContext) {
  return (
    await postgres.query<{ key: string }>(
      `SELECT p.key FROM permissions p WHERE EXISTS(
    SELECT 1 FROM organization_members m WHERE m.organization_id=$1 AND m.user_id=$2 AND (
    (m.role<>'CUSTOM' AND EXISTS(SELECT 1 FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE r.key=m.role AND rp.permission_id=p.id)) OR
    (m.role='CUSTOM' AND EXISTS(SELECT 1 FROM organization_role_permissions rp WHERE rp.organization_id=m.organization_id AND rp.role_id=m.custom_role_id AND rp.permission_id=p.id)))) ORDER BY p.key`,
      [ctx.organizationId, ctx.userId],
    )
  ).rows.map((p) => p.key);
}
