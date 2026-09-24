import { endpoint } from "@/server/http";
import { cancelSale } from "@/server/sales";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => cancelSale((await params).id));
}
