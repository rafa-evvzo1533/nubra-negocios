import { endpoint } from "@/server/http";
import { supportRead } from "@/server/support-access";
export async function GET(
  _: Request,
  c: { params: Promise<{ id: string; resource: string }> },
) {
  return endpoint(async () => {
    const p = await c.params;
    return supportRead(p.id, p.resource);
  });
}
