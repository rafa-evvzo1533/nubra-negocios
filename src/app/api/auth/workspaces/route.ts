import { z } from "zod";
import { getUserSession } from "@/server/auth";
import { postgres } from "@/server/postgres";
import { endpoint, HttpError } from "@/server/http";
export async function GET() {
  return endpoint(async () => {
    const ctx = await getUserSession();
    if (!ctx) throw new HttpError(401, "Iniciá sesión");
    return (
      await postgres.query(
        "SELECT o.id,o.name,m.role FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND o.active ORDER BY o.name",
        [ctx.userId],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return endpoint(async () => {
    const ctx = await getUserSession();
    if (!ctx) throw new HttpError(401, "Iniciá sesión");
    const { workspaceId } = z
      .object({ workspaceId: z.uuid() })
      .strict()
      .parse(await request.json());
    const result = await postgres.query(
      "UPDATE sessions SET organization_id=$1 WHERE id=$2 AND user_id=$3 AND expires_at>NOW() AND EXISTS(SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$3 AND o.active) RETURNING id",
      [workspaceId, ctx.sessionId, ctx.userId],
    );
    if (!result.rows.length)
      throw new HttpError(403, "Workspace no disponible");
    return { switched: true };
  });
}
