"use client";
import Link from "next/link";
import { useState } from "react";
import type { BillingPeriod } from "@/domain/billing-period";
import { Check, ArrowUpRight, Sparkles } from "lucide-react";
import s from "./Foundation.module.css";
export type PlanCardData = {
  code: string;
  name: string;
  price_cents: number | null;
  currency: string;
  checkout_enabled: boolean;
  annual_price_cents?: number | null;
  annual_checkout_enabled?: boolean;
  entitlements: {
    key: string;
    name: string;
    enabled: boolean;
    available: boolean;
    limit: number | null;
  }[];
};
const descriptions: Record<string, string> = {
  FREE: "Todo lo esencial para empezar bien.",
  LITE: "Más espacio para crecer en equipo.",
  BUSINESS: "Capacidad para una operación en expansión.",
  ENTERPRISE: "Mayor escala para empresas consolidadas.",
};
export const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export function PlanCards({
  plans,
  current,
  onChoose,
  busy,
  canPay = false,
  canManage = true,
}: {
  plans: PlanCardData[];
  current?: string;
  onChoose?: (p: PlanCardData, period: BillingPeriod) => void;
  busy?: boolean;
  canPay?: boolean;
  canManage?: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  return (
    <>
      <div
        className={s.actions}
        role="group"
        aria-label="Período de suscripción"
        style={{ marginBottom: 24 }}
      >
        <button
          type="button"
          className={
            period === "MONTHLY" ? "primary-button" : "secondary-button"
          }
          aria-pressed={period === "MONTHLY"}
          onClick={() => setPeriod("MONTHLY")}
        >
          Mensual
        </button>
        <button
          type="button"
          className={
            period === "YEARLY" ? "primary-button" : "secondary-button"
          }
          aria-pressed={period === "YEARLY"}
          onClick={() => setPeriod("YEARLY")}
        >
          Anual
        </button>
      </div>
      <div className={s.plans}>
        {plans.map((original) => {
          const plan =
            period === "YEARLY"
              ? {
                  ...original,
                  price_cents: original.annual_price_cents ?? null,
                  checkout_enabled: original.annual_checkout_enabled ?? false,
                }
              : original;
          return (
            <article
              key={plan.code}
              className={`${s.priceCard} ${plan.code === "BUSINESS" ? s.featuredPlan : ""}`}
            >
              {plan.code === "BUSINESS" && (
                <div className={s.recommended}>
                  <Sparkles size={13} /> Para crecer en equipo
                </div>
              )}
              <span className={s.eyebrow}>{plan.code}</span>
              <h2>{plan.name.replace("Nubra Negocios ", "")}</h2>
              <p>{descriptions[plan.code]}</p>
              <div className={s.price}>
                {plan.code === "FREE"
                  ? "Gratis"
                  : plan.price_cents
                    ? formatPrice(plan.price_cents, plan.currency)
                    : "Consultar"}
                {plan.price_cents && (
                  <small>
                    {plan.currency} / {period === "YEARLY" ? "año" : "mes"}
                  </small>
                )}
              </div>
              <p className={s.period}>
                {plan.code === "FREE"
                  ? "Sin vencimiento. Límites de uso."
                  : plan.price_cents
                    ? "Pago único por período. Sin débito automático."
                    : "Precio a confirmar por NUBRA."}
              </p>
              {onChoose ? (
                <button
                  className={
                    plan.code === "BUSINESS"
                      ? "primary-button"
                      : "secondary-button"
                  }
                  disabled={busy || !canManage || plan.code === "FREE"}
                  onClick={() => onChoose(plan, period)}
                >
                  {plan.code === "FREE"
                    ? current === "FREE"
                      ? "Tu plan actual"
                      : "Incluido como base"
                    : canPay && plan.checkout_enabled && plan.price_cents
                      ? current === plan.code
                        ? "Renovar con Mercado Pago"
                        : "Elegir y pagar"
                      : "Consultar este plan"}
                  <ArrowUpRight size={15} />
                </button>
              ) : (
                <Link
                  className={
                    plan.code === "BUSINESS"
                      ? "primary-button"
                      : "secondary-button"
                  }
                  href={
                    plan.code === "FREE"
                      ? "/register-business"
                      : "/settings/subscription"
                  }
                >
                  {plan.code === "FREE"
                    ? "Registrar mi negocio"
                    : "Ver suscripción"}
                  <ArrowUpRight size={15} />
                </Link>
              )}
              <ul className={s.benefits}>
                {plan.entitlements
                  .filter((f) => f.available && f.enabled)
                  .map((f) => (
                    <li key={f.key}>
                      <Check size={15} />
                      <span>
                        {f.limit !== null ? (
                          <>
                            <strong>{f.limit.toLocaleString("es-AR")}</strong>{" "}
                            {f.name.toLowerCase()}
                          </>
                        ) : (
                          f.name
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
              {plan.code === "LITE" && (
                <p className={s.bundle}>También incluido con Nubra Basic.</p>
              )}
              {plan.code === "ENTERPRISE" && (
                <p className={s.bundle}>
                  También incluido con Nubra Enterprise.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
