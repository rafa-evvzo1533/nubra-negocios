import { endpoint } from "@/server/http";
import { financeSummary } from "@/server/finance";
export async function GET() {
  return endpoint(financeSummary);
}
