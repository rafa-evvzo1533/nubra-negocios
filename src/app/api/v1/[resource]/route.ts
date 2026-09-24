import { endpoint } from "@/server/http";
import { list, mutate, resources } from "@/server/business";
import { createQuote } from "@/server/quotes";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(async () =>
    list(
      resources.parse((await params).resource),
      undefined,
      new URL(request.url).searchParams,
    ),
  );
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(async () => {
    const resource = resources.parse((await params).resource);
    const body = await request.json();
    return resource === "quotes" ? createQuote(body) : mutate(resource, body);
  }, 201);
}
