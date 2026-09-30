import { z } from "zod";
import { billingReady } from "./mercado-pago";
import { HttpError } from "./http";

const identifier = z.union([z.string(), z.number()]).transform(String);
export const agreementSchema = z.object({
  id: z.string(),
  collector_id: identifier,
  external_reference: z.string(),
  status: z.enum(["pending", "authorized", "paused", "cancelled"]),
  init_point: z.url().optional(),
  next_payment_date: z.string().nullish(),
  auto_recurring: z.object({
    frequency: z.number(),
    frequency_type: z.string(),
    transaction_amount: z.number(),
    currency_id: z.string(),
  }),
});
export const invoiceSchema = z.object({
  id: identifier,
  preapproval_id: z.string(),
  external_reference: z.union([z.string(), z.number()]).nullish(),
  transaction_amount: z.coerce.number(),
  currency_id: z.string(),
  payment: z.object({ id: identifier, status: z.string() }).nullish(),
});
export class RecurringProvider {
  private async request(path: string, method = "GET", body?: unknown) {
    if (!billingReady())
      throw new HttpError(
        503,
        "Los pagos online todavía no están habilitados.",
      );
    let response: Response;
    try {
      response = await fetch("https://api.mercadopago.com" + path, {
        method,
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new HttpError(
        502,
        "No pudimos conectar con Mercado Pago. Volvé a intentar.",
      );
    }
    if (!response.ok)
      throw new HttpError(502, "Mercado Pago no pudo procesar la suscripción.");
    return response.json();
  }
  private id(id: string) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new HttpError(400, "Referencia de suscripción inválida");
    return encodeURIComponent(id);
  }
  async create(input: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    email: string;
  }) {
    const base = new URL(process.env.APP_URL!);
    if (
      base.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(base.hostname)
    )
      throw new HttpError(503, "URL de pagos inválida");
    const result = agreementSchema.parse(
      await this.request("/preapproval", "POST", {
        reason: input.name + " · renovación mensual",
        external_reference: input.id,
        payer_email: input.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: input.amount / 100,
          currency_id: input.currency,
        },
        back_url: new URL(
          "/settings/subscription?agreement=" + input.id,
          base,
        ).toString(),
        status: "pending",
      }),
    );
    const url = new URL(result.init_point ?? "https://invalid.invalid");
    if (
      url.protocol !== "https:" ||
      ![
        "www.mercadopago.com.ar",
        "www.mercadopago.com",
        "sandbox.mercadopago.com.ar",
        "sandbox.mercadopago.com",
      ].includes(url.hostname)
    )
      throw new HttpError(502, "Enlace de suscripción inválido");
    return { ...result, url: url.toString() };
  }
  async get(id: string) {
    return agreementSchema.parse(
      await this.request("/preapproval/" + this.id(id)),
    );
  }
  async cancel(id: string) {
    return agreementSchema.parse(
      await this.request("/preapproval/" + this.id(id), "PUT", {
        status: "cancelled",
      }),
    );
  }
  async invoice(id: string) {
    return invoiceSchema.parse(
      await this.request("/authorized_payments/" + this.id(id)),
    );
  }
  async invoices(id: string) {
    return z
      .object({ results: z.array(invoiceSchema) })
      .parse(
        await this.request(
          "/authorized_payments/search?preapproval_id=" +
            this.id(id) +
            "&limit=100",
        ),
      ).results;
  }
}
