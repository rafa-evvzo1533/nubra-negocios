import { endpoint } from "@/server/http";
import { requestReset } from "@/server/recovery";
export async function POST(request: Request) {
  return endpoint(async () => requestReset(await request.json()));
}
