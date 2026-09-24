import { endpoint } from "@/server/http";
import { registerPayment } from "@/server/finance";
export async function POST(request: Request) {
  return endpoint(async () => registerPayment(await request.json()));
}
