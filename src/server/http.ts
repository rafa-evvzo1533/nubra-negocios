import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readJson(
  request: Request,
  maxBytes = 65536,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Falta el cuerpo de la solicitud");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Solicitud demasiado grande");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function endpoint(action: () => Promise<unknown>, status = 200) {
  try {
    return Response.json(await action(), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError)
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    const code = (error as { code?: string }).code;
    if (code === "23505" || code === "23503")
      return Response.json(
        {
          error: "El recurso ya existe o está relacionado con otros registros",
        },
        { status: 409 },
      );
    console.error("Request failed", { code: code ?? "internal" });
    return Response.json(
      { error: "No se pudo completar la operación" },
      { status: 500 },
    );
  }
}
