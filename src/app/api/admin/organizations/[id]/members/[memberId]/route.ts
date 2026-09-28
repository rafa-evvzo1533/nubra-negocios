import { endpoint, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
async function deny() {
  await requireAdmin();
  throw new HttpError(
    403,
    "Solo el propietario y los administradores del negocio pueden modificar sus accesos.",
  );
}
export async function PATCH() {
  return endpoint(deny);
}
export async function DELETE() {
  return endpoint(deny);
}
