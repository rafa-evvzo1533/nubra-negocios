import { endpoint } from "@/server/http";
import { revokeInvitation } from "@/server/invitations";
export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => revokeInvitation((await ctx.params).id));
}
