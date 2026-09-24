import { endpoint } from "@/server/http";
import { list, mutate, resources } from "@/server/business";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return endpoint(async () => {
    const p = await params;
    return list(resources.parse(p.resource), p.id);
  });
}
export async function PUT(request: Request, { params }: Context) {
  return endpoint(async () => {
    const p = await params;
    return mutate(resources.parse(p.resource), await request.json(), p.id);
  });
}
export async function DELETE(_request: Request, { params }: Context) {
  return endpoint(async () => {
    const p = await params;
    return mutate(resources.parse(p.resource), null, p.id, true);
  });
}
