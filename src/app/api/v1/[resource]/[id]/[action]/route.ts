import { endpoint, HttpError } from "@/server/http";
import { customerActivities } from "@/server/crm";
import { convertQuote, updateQuote } from "@/server/quotes";
type Context = {
  params: Promise<{ resource: string; id: string; action: string }>;
};
export async function GET(_request: Request, { params }: Context) {
  return endpoint(async () => {
    const p = await params;
    if (p.resource === "customers" && p.action === "activities")
      return customerActivities(p.id);
    throw new HttpError(404, "Ruta no encontrada");
  });
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(async () => {
    const p = await params;
    if (p.resource === "customers" && p.action === "activities")
      return customerActivities(p.id, await request.json());
    if (p.resource === "quotes" && p.action === "status")
      return updateQuote(p.id, await request.json());
    if (p.resource === "quotes" && p.action === "convert")
      return convertQuote(p.id);
    throw new HttpError(404, "Ruta no encontrada");
  });
}
