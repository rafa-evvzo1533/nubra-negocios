import { endpoint, readJson } from "@/server/http";
import { decideSupport } from "@/server/support-access";
export async function POST(r: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () =>
    decideSupport((await c.params).id, await readJson(r)),
  );
}
