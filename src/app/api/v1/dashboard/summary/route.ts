import { getUserSession } from "@/server/auth";
import { dashboard } from "@/server/dashboard";
import { endpoint, HttpError } from "@/server/http";
export async function GET() {
  return endpoint(async () => {
    const session = await getUserSession();
    if (!session) throw new HttpError(401, "Iniciá sesión");
    return dashboard(session);
  });
}
