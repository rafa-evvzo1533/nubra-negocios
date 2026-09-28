import { getStaffSession } from "./auth";
import { HttpError } from "./http";
import { postgres } from "./postgres";
import { randomUUID } from "node:crypto";
export async function requireAdmin(
  capability:
    "legacy" | "review" | "read" | "billing" | "operations" = "legacy",
) {
  const actor = await getStaffSession();
  if (!actor)
    throw new HttpError(401, "Iniciá sesión como administrador Nubra");
  const allowed: Record<string, string[]> = {
    legacy: [],
    read: [
      "OPERATIONS_ADMIN",
      "SALES_ADMIN",
      "SUPPORT_ADMIN",
      "BILLING_ADMIN",
      "REVIEWER",
      "READ_ONLY",
      "SECURITY_ADMIN",
    ],
    review: ["OPERATIONS_ADMIN", "REVIEWER"],
    billing: ["BILLING_ADMIN", "SALES_ADMIN"],
    operations: ["OPERATIONS_ADMIN"],
  };
  if (actor.role !== "SUPER_ADMIN" && !allowed[capability].includes(actor.role))
    throw new HttpError(403, "Permisos internos insuficientes");
  if (capability === "legacy")
    await postgres.query(
      "INSERT INTO platform_audit_logs(id,staff_id,action) VALUES($1,$2,'admin.privileged_access')",
      [randomUUID(), actor.id],
    );
  return actor;
}
