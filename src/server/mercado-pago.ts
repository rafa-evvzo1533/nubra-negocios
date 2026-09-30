import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingProvider } from "./billing";
import { HttpError } from "./http";
export function billingReady() {
  return (
    process.env.BILLING_ENABLED === "true" &&
    ["sandbox", "live"].includes(process.env.MP_MODE ?? "") &&
    !!process.env.MP_ACCESS_TOKEN &&
    !!process.env.MP_WEBHOOK_SECRET &&
    !!process.env.MP_COLLECTOR_ID &&
    !!process.env.APP_URL
  );
}
export function verifyMercadoPagoSignature(
  signature: string | null,
  requestId: string | null,
  dataId: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !signature ||
    !requestId ||
    requestId.length > 200 ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(dataId)
  )
    return false;
  const fields = Object.fromEntries(
    signature.split(",").map((s) => s.trim().split("=")),
  );
  const { ts, v1 } = fields;
  if (!/^\d{10,13}$/.test(ts ?? "") || !/^[a-f0-9]{64}$/.test(v1 ?? ""))
    return false;
  const timestamp = Number(ts) * (ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 600000) return false;
  const expected = createHmac("sha256", secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(v1, "hex"));
}
const paymentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
  external_reference: z.string().nullable(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  collector_id: z.union([z.string(), z.number()]).transform(String),
  live_mode: z.boolean(),
  transaction_amount_refunded: z.number().default(0),
});
export type VerifiedPayment = z.infer<typeof paymentSchema>;
export class MercadoPagoProvider implements BillingProvider {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async request(path: string, body?: unknown, key?: string) {
    if (!billingReady())
      throw new HttpError(
        503,
        "Los pagos online todavía no están habilitados.",
      );
    let response: Response;
    try {
      response = await this.transport("https://api.mercadopago.com" + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          ...(key ? { "X-Idempotency-Key": key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
    } catch {
      throw new HttpError(
        502,
        "No se pudo conectar con Mercado Pago. Volvé a intentar.",
      );
    }
    if (!response.ok)
      throw new HttpError(502, "Mercado Pago no pudo procesar la solicitud.");
    return response.json();
  }
  async createCheckout(input: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    email: string;
    period: "MONTHLY" | "YEARLY";
  }) {
    const base = new URL(process.env.APP_URL!);
    if (
      base.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(base.hostname)
    )
      throw new HttpError(503, "Configuración de pagos inválida");
    const returnUrl = new URL(
      "/settings/subscription?order=" + input.id,
      base,
    ).toString();
    const result = z
      .object({
        id: z.string(),
        init_point: z.url(),
        sandbox_init_point: z.url().optional(),
      })
      .parse(
        await this.request(
          "/checkout/preferences",
          {
            items: [
              {
                id: input.id,
                title:
                  input.name +
                  (input.period === "YEARLY" ? " · anual" : " · mensual"),
                quantity: 1,
                currency_id: input.currency,
                unit_price: input.amount / 100,
              },
            ],
            payer: { email: input.email },
            external_reference: input.id,
            notification_url: new URL(
              "/api/billing/mercadopago/webhook?source_news=webhooks",
              base,
            ).toString(),
            back_urls: {
              success: returnUrl,
              pending: returnUrl,
              failure: returnUrl,
            },
            ...(base.protocol === "https:" ? { auto_return: "approved" } : {}),
            expires: true,
            expiration_date_to: new Date(
              Date.now() + 24 * 3600000,
            ).toISOString(),
            binary_mode: true,
          },
          input.id,
        ),
      );
    const url =
      process.env.MP_MODE === "live"
        ? result.init_point
        : result.sandbox_init_point;
    if (!url)
      throw new HttpError(502, "Mercado Pago no devolvió un enlace de prueba");
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      ![
        "www.mercadopago.com",
        "www.mercadopago.com.ar",
        "sandbox.mercadopago.com",
        "sandbox.mercadopago.com.ar",
      ].includes(parsed.hostname)
    )
      throw new HttpError(502, "Enlace de pago inválido");
    return { url, reference: result.id };
  }
  async payment(id: string) {
    if (!/^\d{1,30}$/.test(id))
      throw new HttpError(400, "Referencia de pago inválida");
    return paymentSchema.parse(await this.request("/v1/payments/" + id));
  }
}
