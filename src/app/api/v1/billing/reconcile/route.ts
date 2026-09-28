import { endpoint, readJson } from "@/server/http";
import { reconcileCheckout } from "@/server/checkout";
export async function POST(request: Request) {
  return endpoint(async () => reconcileCheckout(await readJson(request)));
}
