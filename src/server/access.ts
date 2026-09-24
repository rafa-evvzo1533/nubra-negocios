import { getUserSession } from "./auth";
import { HttpError } from "./http";
import { requirePermission } from "./rbac";
import { hasFeature } from "./subscriptions";
export async function requireAccess(kind: "team" | "finance", write = false) {
  const ctx = await getUserSession();
  if (!ctx) throw new HttpError(401, "Iniciá sesión");
  await requirePermission(
    ctx,
    `${kind === "team" ? "members" : "cash"}.${write ? "write" : "read"}`,
  );
  if (kind === "finance" && !(await hasFeature(ctx, "core_business")))
    throw new HttpError(403, "Tu suscripción no habilita esta función");
  return ctx;
}
