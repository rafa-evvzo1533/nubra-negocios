import { endpoint } from "@/server/http";
import { changeCash } from "@/server/finance";
export async function POST(request: Request) {
  return endpoint(async () => changeCash(await request.json()));
}
