import { endpoint } from "@/server/http";
import { createFileLink } from "@/server/private-files";
export async function POST(_: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => createFileLink((await c.params).id));
}
