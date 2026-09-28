import { endpoint } from "@/server/http";
import { listSupport } from "@/server/support-access";
export async function GET() {
  return endpoint(() => listSupport());
}
