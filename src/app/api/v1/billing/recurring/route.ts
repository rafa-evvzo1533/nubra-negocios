import { endpoint, readJson } from "@/server/http";
import { createRecurring, manageRecurring } from "@/server/recurring";
export async function POST(request: Request) {
  return endpoint(async () => createRecurring(await readJson(request)));
}
export async function PATCH(request: Request) {
  return endpoint(async () => manageRecurring(await readJson(request)));
}
