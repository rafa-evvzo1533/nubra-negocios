import { endpoint, HttpError } from "@/server/http";
import { authorize } from "@/server/business";
import { importReceipt } from "@/server/receipts";
export async function POST(request: Request) {
  return endpoint(async () => {
    await authorize("sales", true);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Falta imagen");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4100000) {
        await reader.cancel();
        throw new HttpError(413, "La imagen es demasiado grande");
      }
      chunks.push(value);
    }
    return importReceipt(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  }, 201);
}
