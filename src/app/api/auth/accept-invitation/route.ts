import { endpoint, readJson } from "@/server/http";
import { acceptInvitation } from "@/server/invitations";
export async function POST(r: Request) {
  return endpoint(async () => acceptInvitation(await readJson(r)));
}
