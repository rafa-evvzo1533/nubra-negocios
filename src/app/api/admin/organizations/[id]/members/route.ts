import { endpoint } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { members, addMember } from "@/server/members";
type C = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: C) {
  return endpoint(async () => {
    await requireAdmin();
    return members((await params).id);
  });
}
export async function POST(request: Request, { params }: C) {
  return endpoint(async () => {
    await requireAdmin();
    return addMember((await params).id, await request.json());
  }, 201);
}
