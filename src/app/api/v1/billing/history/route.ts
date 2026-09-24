import { endpoint } from "@/server/http";
import { billingHistory } from "@/server/checkout";
export async function GET() {
  return endpoint(billingHistory);
}
