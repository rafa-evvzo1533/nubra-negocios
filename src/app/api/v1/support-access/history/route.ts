import { endpoint } from "@/server/http";
import { supportHistory } from "@/server/support-access";
export async function GET() {
  return endpoint(supportHistory);
}
