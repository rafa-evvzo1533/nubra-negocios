import { readJson, endpoint } from "@/server/http";
import { applicationStatus, saveApplication } from "@/server/applications";
export async function GET() {
  return endpoint(applicationStatus);
}
export async function POST(request: Request) {
  return endpoint(async () => saveApplication(await readJson(request)));
}
