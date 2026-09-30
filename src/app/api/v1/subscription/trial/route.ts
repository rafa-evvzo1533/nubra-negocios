import { endpoint } from "@/server/http";
import { claimBusinessTrial } from "@/server/trials";
export async function POST() {
  return endpoint(claimBusinessTrial);
}
