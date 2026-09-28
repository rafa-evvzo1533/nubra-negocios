import { endpoint, readJson } from "@/server/http";
import { listSessions, revokeSessions } from "@/server/session-management";
export async function GET() {
  return endpoint(listSessions);
}
export async function DELETE(r: Request) {
  return endpoint(async () => revokeSessions(await readJson(r)));
}
