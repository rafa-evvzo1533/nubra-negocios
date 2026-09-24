import { endpoint } from "@/server/http";
import { requireAccess } from "@/server/access";
import { changeMember } from "@/server/members";
type C = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: C) {
  return endpoint(async () => {
    const ctx = await requireAccess("team", true);
    return changeMember(
      ctx.organizationId,
      (await params).id,
      await request.json(),
      ctx,
    );
  });
}
export async function DELETE(_request: Request, { params }: C) {
  return endpoint(async () => {
    const ctx = await requireAccess("team", true);
    return changeMember(ctx.organizationId, (await params).id, null, ctx);
  });
}
