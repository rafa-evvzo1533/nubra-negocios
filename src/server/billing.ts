import type { VerifiedPayment } from "./mercado-pago";
export interface BillingProvider {
  createCheckout(input: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    email: string;
    period: "MONTHLY" | "YEARLY";
  }): Promise<{ url: string; reference: string }>;
  payment(id: string): Promise<VerifiedPayment>;
}
