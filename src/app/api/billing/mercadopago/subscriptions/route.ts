import { endpoint } from "@/server/http";
import { recurringWebhook } from "@/server/recurring";
export async function POST(request: Request) {
  return endpoint(() => recurringWebhook(request));
}
