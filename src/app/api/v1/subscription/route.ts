import { readJson, endpoint } from "@/server/http";
import { subscriptionSummary, requestUpgrade } from "@/server/subscriptions";
export async function GET() {
  return endpoint(subscriptionSummary);
}
export async function POST(request: Request) {
  return endpoint(async () => requestUpgrade(await readJson(request)));
}
