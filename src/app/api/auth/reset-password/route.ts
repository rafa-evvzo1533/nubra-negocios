import { endpoint } from "@/server/http";
import { resetPassword } from "@/server/recovery";
export async function POST(request: Request) {
  return endpoint(async () => resetPassword(await request.json()));
}
