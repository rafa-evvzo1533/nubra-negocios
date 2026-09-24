import { endpoint } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { changeMember } from "@/server/members";
type C = { params: Promise<{ id: string; memberId: string }> };
export async function PATCH(request: Request, { params }: C) {
  return endpoint(async () => {
    await requireAdmin();
    const p = await params;
    return changeMember(p.id, p.memberId, await request.json(), null);
  });
}
export async function DELETE(_request: Request, { params }: C) {
  return endpoint(async () => {
    await requireAdmin();
    const p = await params;
    return changeMember(p.id, p.memberId, null, null);
  });
}
