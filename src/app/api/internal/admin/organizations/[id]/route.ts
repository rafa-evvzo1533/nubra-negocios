import { z } from "zod";
import { readJson, endpoint } from "@/server/http";
import { setOrganizationStatus } from "@/server/applications";
import {
  changeOrganizationPlan,
  revokeSubscription,
} from "@/server/subscriptions";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { id } = await params;
    const v = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("status"),
            status: z.enum(["APPROVED", "SUSPENDED", "BLOCKED"]),
            reason: z.string().min(3).max(1000),
          })
          .strict(),
        z
          .object({ action: z.literal("plan"), subscription: z.unknown() })
          .strict(),
        z
          .object({
            action: z.literal("revoke"),
            reason: z.string().min(3).max(1000),
          })
          .strict(),
      ])
      .parse(await readJson(request));
    if (v.action === "status")
      return setOrganizationStatus(id, v.status, v.reason);
    if (v.action === "revoke") return revokeSubscription(id, v.reason);
    return changeOrganizationPlan(id, v.subscription);
  });
}
