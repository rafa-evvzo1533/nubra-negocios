import { endpoint, readJson } from "@/server/http";
import { invitations, invite } from "@/server/invitations";
export async function GET() {
  return endpoint(invitations);
}
export async function POST(r: Request) {
  return endpoint(async () => invite(await readJson(r)), 201);
}
