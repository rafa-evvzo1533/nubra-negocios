import { endpoint, readJson } from "@/server/http";
import { checkout } from "@/server/checkout";
export async function POST(request: Request) {
  return endpoint(async () => checkout(await readJson(request)));
}
