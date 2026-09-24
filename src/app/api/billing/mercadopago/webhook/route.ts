import { endpoint } from "@/server/http";
import { receivePaymentWebhook } from "@/server/checkout";
export async function POST(request: Request) {
  return endpoint(() => receivePaymentWebhook(request));
}
