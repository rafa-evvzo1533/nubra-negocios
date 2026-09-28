import { endpoint, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { members } from "@/server/members";
export async function GET(_: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    await requireAdmin();
    return members((await c.params).id);
  });
}
export async function POST() {
  return endpoint(async () => {
    await requireAdmin();
    throw new HttpError(
      403,
      "El propietario debe invitar al integrante desde su negocio. NUBRA no puede conceder acceso empresarial.",
    );
  });
}
