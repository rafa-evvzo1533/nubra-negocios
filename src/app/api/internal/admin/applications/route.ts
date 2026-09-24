import { endpoint } from "@/server/http";
import { reviewApplications } from "@/server/applications";
export async function GET() {
  return endpoint(reviewApplications);
}
