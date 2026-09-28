import { endpoint } from "@/server/http";
import { downloadFile } from "@/server/private-files";
export async function GET(r: Request) {
  let row: Awaited<ReturnType<typeof downloadFile>> | undefined;
  const result = await endpoint(async () => {
    row = await downloadFile(new URL(r.url));
    return { ok: true };
  });
  if (!result.ok || !row) return result;
  return new Response(new Uint8Array(row.image_data as Buffer), {
    headers: {
      "Content-Type": String(row.mime_type),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="comprobante"',
    },
  });
}
