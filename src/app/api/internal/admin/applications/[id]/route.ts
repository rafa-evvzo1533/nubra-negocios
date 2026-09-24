import { z } from "zod";
import { readJson, endpoint } from "@/server/http";
import {
  approveOrganizationApplication,
  rejectOrganizationApplication,
  requestOrganizationInformation,
  startApplicationReview,
} from "@/server/applications";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = (await params).id;
    const v = z
      .object({
        action: z.enum(["approve", "reject", "information", "review"]),
        message: z.string().max(1000).default(""),
      })
      .strict()
      .parse(await readJson(request));
    if (v.action === "approve") return approveOrganizationApplication(id);
    if (v.action === "reject")
      return rejectOrganizationApplication(id, v.message);
    if (v.action === "review") return startApplicationReview(id, v.message);
    return requestOrganizationInformation(id, v.message);
  });
}
