import { endpoint } from "@/server/http";
import { requireAccess } from "@/server/access";
import { members } from "@/server/members";
export async function GET() {
  return endpoint(async () =>
    members((await requireAccess("team")).organizationId),
  );
}
