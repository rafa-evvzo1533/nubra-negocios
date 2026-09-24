import { receiptImage } from "@/server/receipts";
import { HttpError } from "@/server/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const row = await receiptImage((await params).id);
    return new Response(new Uint8Array(row.image_data as Buffer), {
      headers: {
        "Content-Type": String(row.mime_type),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="comprobante"',
      },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof HttpError ? e.message : "No se pudo leer el comprobante",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
