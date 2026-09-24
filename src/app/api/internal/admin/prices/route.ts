import { endpoint, readJson } from "@/server/http";
import { configurePrice } from "@/server/checkout";
export async function PATCH(request: Request) {
  return endpoint(async () => configurePrice(await readJson(request)));
}
