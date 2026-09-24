import { endpoint, readJson } from "@/server/http";
import {
  saveOrganizationRole,
  deleteOrganizationRole,
} from "@/server/organization-roles";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, { params }: Context) {
  return endpoint(async () =>
    saveOrganizationRole(await readJson(request), (await params).id),
  );
}
export async function DELETE(_request: Request, { params }: Context) {
  return endpoint(async () => deleteOrganizationRole((await params).id));
}
