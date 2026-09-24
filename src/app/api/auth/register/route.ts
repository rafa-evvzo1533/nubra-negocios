import { readJson, endpoint } from "@/server/http";
import { registerAccount } from "@/server/registration";
export async function POST(request: Request) {
  return endpoint(async () => registerAccount(await readJson(request)), 201);
}
