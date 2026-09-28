import { endpoint, readJson } from "@/server/http";
import { listSupport, requestSupport } from "@/server/support-access";
export async function GET() {
  return endpoint(() => listSupport(true));
}
export async function POST(r: Request) {
  return endpoint(async () => requestSupport(await readJson(r)), 201);
}
