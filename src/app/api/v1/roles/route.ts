import { endpoint, readJson } from "@/server/http";
import {
  listOrganizationRoles,
  saveOrganizationRole,
} from "@/server/organization-roles";
export async function GET() {
  return endpoint(listOrganizationRoles);
}
export async function POST(request: Request) {
  return endpoint(
    async () => saveOrganizationRole(await readJson(request)),
    201,
  );
}
