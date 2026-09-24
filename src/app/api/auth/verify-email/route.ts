import { readJson, endpoint } from "@/server/http";
import { verifyEmail, resendVerification } from "@/server/registration";
export async function POST(request: Request) {
  return endpoint(async () => verifyEmail(await readJson(request)));
}
export async function PUT() {
  return endpoint(resendVerification);
}
