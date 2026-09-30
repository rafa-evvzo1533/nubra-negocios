"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "./AccountForms";
import { Dialog } from "../ui/Dialog";
import { PlanCards, formatPrice, type PlanCardData } from "./PlanCards";
import s from "./Foundation.module.css";
import { Brand } from "../ui/Brand";
import { notify } from "../ui/Notifications";
import type { BillingPeriod } from "@/domain/billing-period";
type Data = {
  subscription: {
    name: string;
    code: string;
    source: string;
    status: string;
    expires_at: string | null;
    trial_ends_at?: string | null;
  };
  usage: Record<string, number>;
  entitlements: {
    key: string;
    name: string;
    enabled: boolean;
    available: boolean;
    limit_value: number | null;
  }[];
  plans: PlanCardData[];
  billingReady: boolean;
  canManage: boolean;
  trialAvailable: boolean;
  recurring: {
    id: string;
    name: string;
    status: string;
    amount_cents: number;
    currency: string;
    next_payment_at: string | null;
    checkout_url: string | null;
  } | null;
};
type Order = {
  id: string;
  name: string;
  amount_cents: number;
  currency: string;
  status: string;
  billing_period: string;
  created_at: string;
  checkout_url: string | null;
};
const statuses: Record<string, string> = {
  CREATING: "Preparando",
  PENDING: "Pendiente",
  PAID: "Acreditado",
  FAILED: "Rechazado",
  REFUNDED: "Devuelto o revertido",
  REVIEW: "En revisión",
};
export function SubscriptionView({ data }: { data: Data }) {
  const router = useRouter();
  const [trialDialog, setTrialDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [renewalConsent, setRenewalConsent] = useState(false);
  const [selected, setSelected] = useState<PlanCardData | null>(null),
    [period, setPeriod] = useState<BillingPeriod>("MONTHLY"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [orders, setOrders] = useState<Order[]>([]),
    [revision, setRevision] = useState(0);
  const key = useRef<{
    plan: string;
    period: BillingPeriod;
    id: string;
  } | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("agreement");
    if (!data.canManage || !id || id !== data.recurring?.id) return;
    let active = true,
      attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function checkRecurring() {
      try {
        await api("/api/v1/billing/recurring", "PATCH", { id, action: "sync" });
        const current: Data = await api("/api/v1/subscription");
        if (!active) return;
        router.refresh();
        if (
          current.subscription.source === "DIRECT_PURCHASE" ||
          current.recurring?.status === "CANCELLED"
        )
          return;
        setMessage(
          "Esperando la autorización y el primer pago de Mercado Pago. Business se activa después de la acreditación.",
        );
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "No pudimos consultar la renovación",
          );
      }
      if (active && ++attempts < 12) timer = setTimeout(checkRecurring, 10000);
    }
    void checkRecurring();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data.canManage, data.recurring?.id, router]);
  useEffect(() => {
    if (!data.canManage) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    if (!orderId) return;
    const paymentId = params.get("payment_id") ?? params.get("collection_id");
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        if (paymentId && attempts % 4 === 0)
          await api("/api/v1/billing/reconcile", "POST", {
            orderId,
            paymentId,
          });
        const history: Order[] = await api("/api/v1/billing/history", "GET");
        if (!active) return;
        setOrders(history);
        const order = history.find((o) => o.id === orderId);
        if (order?.status === "PAID") {
          setMessage("");
          notify("Pago aprobado. Tu plan ya está activo.");
          router.refresh();
          return;
        }
        if (order && ["FAILED", "REFUNDED", "REVIEW"].includes(order.status)) {
          setMessage(
            "Estado del pago: " +
              statuses[order.status] +
              ". Consultá el historial.",
          );
          router.refresh();
          return;
        }
        setMessage(
          "Estamos esperando la acreditación de Mercado Pago. El plan se activará automáticamente cuando se apruebe.",
        );
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "No pudimos consultar el pago.",
          );
      }
      if (active && ++attempts < 24) timer = setTimeout(check, 5000);
    }
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data.canManage, router, revision]);
  useEffect(() => {
    if (!data.canManage) return;
    let active = true;
    api("/api/v1/billing/history", "GET")
      .then((d) => {
        if (active) setOrders(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [data.canManage, revision]);
  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (
        data.billingReady &&
        selected.checkout_enabled &&
        selected.price_cents
      ) {
        if (
          key.current?.plan !== selected.code ||
          key.current.period !== period
        )
          key.current = {
            plan: selected.code,
            period,
            id: crypto.randomUUID(),
          };
        if (period === "MONTHLY" && !renewalConsent)
          throw new Error("Confirmá que aceptás la renovación mensual");
        const result = await api(
          period === "MONTHLY"
            ? "/api/v1/billing/recurring"
            : "/api/v1/billing/checkout",
          "POST",
          {
            plan: selected.code,
            idempotencyKey: key.current.id,
            ...(period === "MONTHLY" ? { automaticRenewal: true } : { period }),
          },
        );
        window.location.assign(result.url);
      } else {
        setError(
          "El pago online todavía no está disponible. Volvé a intentarlo más tarde.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago");
      setRevision((r) => r + 1);
    } finally {
      setBusy(false);
    }
  }
  const payable =
    selected &&
    data.billingReady &&
    selected.checkout_enabled &&
    selected.price_cents;
  async function subscriptionAction(action: "trial" | "cancel" | "sync") {
    setBusy(true);
    setError("");
    try {
      const result =
        action === "trial"
          ? await api("/api/v1/subscription/trial", "POST", {})
          : await api("/api/v1/billing/recurring", "PATCH", {
              id: data.recurring!.id,
              action,
            });
      notify(result.message);
      setMessage("");
      setTrialDialog(false);
      setCancelDialog(false);
      router.refresh();
      setRevision((r) => r + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.page}>
      <div className={s.content}>
        <nav className={s.actions}>
          <Link className={s.brand} href="/">
            <Brand />
          </Link>
          <Link href="/">← Volver al negocio</Link>
        </nav>
        <div className={s.pricingIntro}>
          <span className={s.eyebrow}>Tu negocio, a tu ritmo</span>
          <h1>Un plan para cada etapa.</h1>
          <p>
            Conocé tus beneficios, controlá el consumo y elegí cómo seguir
            creciendo.
          </p>
        </div>
        <section className={`${s.card} ${s.subscriptionSummary}`}>
          <div>
            <span className={s.badge}>
              <ShieldCheck size={14} /> Tu suscripción
            </span>
            <h2>{data.subscription?.name ?? "Sin plan activo"}</h2>
            <p>
              {data.subscription?.status === "ACTIVE"
                ? "Activa"
                : "Requiere atención"}
              {data.subscription?.expires_at
                ? ` · Vigente hasta el ${new Date(data.subscription.expires_at).toLocaleDateString("es-AR")}`
                : " · Sin vencimiento programado"}
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              router.refresh();
              setRevision((r) => r + 1);
            }}
          >
            <RefreshCw size={15} />
            Actualizar estado
          </button>
        </section>
        {data.subscription?.source === "BUSINESS_TRIAL" && (
          <section className={`${s.card} ${s.trialOffer}`}>
            <h2>Tu prueba de Business está activa</h2>
            <p>
              Disfrutá las capacidades de Business hasta el{" "}
              {new Date(data.subscription.trial_ends_at!).toLocaleDateString(
                "es-AR",
                { timeZone: "UTC" },
              )}
              . Después volvés automáticamente a Free, sin cargos y conservando
              tus datos.
            </p>
          </section>
        )}
        {data.recurring && (
          <section className={s.card}>
            <h2>Renovación mensual</h2>
            <p>
              {data.recurring.name} ·{" "}
              {formatPrice(
                data.recurring.amount_cents,
                data.recurring.currency,
              )}{" "}
              por mes.
            </p>
            <p>
              {
                (
                  {
                    CREATING: "Preparando suscripción",
                    PENDING: "Pendiente de autorización en Mercado Pago",
                    AUTHORIZED: "Renovación automática activa",
                    PAUSED: "Renovación pausada",
                    CANCELLED: "Renovación cancelada",
                    REVIEW: "Requiere revisión de NUBRA",
                  } as Record<string, string>
                )[data.recurring.status]
              }
            </p>
            {data.recurring.next_payment_at &&
              data.recurring.status !== "CANCELLED" && (
                <p>
                  Próximo cobro previsto:{" "}
                  {new Date(data.recurring.next_payment_at).toLocaleDateString(
                    "es-AR",
                    { timeZone: "UTC" },
                  )}
                  .
                </p>
              )}
            <div className={s.actions}>
              {data.recurring.checkout_url && (
                <a
                  className="primary-button"
                  href={data.recurring.checkout_url}
                >
                  Continuar en Mercado Pago
                </a>
              )}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => subscriptionAction("sync")}
              >
                Consultar renovación
              </button>
              {data.recurring.status !== "CANCELLED" && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setCancelDialog(true)}
                >
                  Cancelar renovación
                </button>
              )}
            </div>
            <p>
              Cancelar detiene los próximos cobros. Conservás el período que ya
              pagaste.
            </p>
          </section>
        )}
        {message && (
          <p role="status" className="notice-success">
            {message}
          </p>
        )}
        {error && !selected && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        <PlanCards
          plans={data.plans}
          current={data.subscription?.code}
          onChoose={(p, chosenPeriod) => {
            setError("");
            setRenewalConsent(false);
            setPeriod(chosenPeriod);
            setSelected(p);
          }}
          busy={busy}
          canManage={data.canManage}
          trialAvailable={data.trialAvailable}
          onTrial={() => {
            setError("");
            setTrialDialog(true);
          }}
        />
        <p className={s.paymentNote}>
          <CreditCard size={18} />
          {data.billingReady
            ? "Pagá de forma segura en Mercado Pago. La acreditación se confirma automáticamente y puede demorar unos minutos."
            : "El pago online estará disponible próximamente. Podés ver los precios y elegir tu plan."}{" "}
          {!data.canManage &&
            "Solo los responsables del negocio pueden contratar."}
        </p>
        <section className={s.card}>
          <h2>Beneficios y consumo de tu plan</h2>
          <p>
            Free no vence. Al alcanzar un límite, necesitás un plan con más
            capacidad para seguir agregando registros. Tus datos se conservan.
            Las ventas y exportaciones se renuevan cada mes calendario (UTC).
          </p>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Capacidad</th>
                  <th>Uso actual</th>
                  <th>Límite del plan</th>
                </tr>
              </thead>
              <tbody>
                {data.entitlements.map((f) => (
                  <tr key={f.key}>
                    <td>{f.name}</td>
                    <td>{data.usage[f.key] ?? "—"}</td>
                    <td>
                      {!f.available
                        ? "Próximamente"
                        : !f.enabled
                          ? "No incluida"
                          : (f.limit_value?.toLocaleString("es-AR") ??
                            "Incluida")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {data.canManage && (
          <section className={s.card}>
            <h2>Historial de pagos</h2>
            <p>
              El plan se activa después de verificar la acreditación. Volver
              desde Mercado Pago no confirma un pago.
            </p>
            {!orders.length ? (
              <p>
                Todavía no hay pagos. Tu primera contratación aparecerá acá.
              </p>
            ) : (
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Plan</th>
                      <th>Importe</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {new Date(o.created_at).toLocaleDateString("es-AR")}
                        </td>
                        <td>
                          {o.name} ·{" "}
                          {o.billing_period === "YEARLY"
                            ? "Anual"
                            : o.billing_period === "LEGACY_30_DAYS"
                              ? "30 días"
                              : "Mensual"}
                        </td>
                        <td>{formatPrice(o.amount_cents, o.currency)}</td>
                        <td>
                          <span className={s.badge}>
                            {statuses[o.status] ?? o.status}
                          </span>
                        </td>
                        <td>
                          {o.checkout_url ? (
                            <a href={o.checkout_url}>Continuar pago ↗</a>
                          ) : o.status === "REVIEW" ? (
                            "Contactá a NUBRA"
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {selected && (
          <Dialog
            title="Comprar plan"
            onClose={() => setSelected(null)}
            busy={busy}
          >
            <div className={s.form}>
              <h3>{selected.name}</h3>
              <p className={s.muted}>
                {selected.price_cents
                  ? `${formatPrice(selected.price_cents!, selected.currency)} ${period === "YEARLY" ? "por el año completo, en un pago único." : "por mes, con renovación y cobro automático hasta que canceles desde esta pantalla. El primer cobro se realiza al autorizar la suscripción."}${payable ? " Vas a continuar en Mercado Pago." : ""}`
                  : "El precio de este período todavía no está disponible."}
              </p>
              {!payable && (
                <p className={s.trialOffer} role="status">
                  El pago online todavía no está disponible. Volvé a intentarlo
                  más tarde. Tu plan actual no cambia.
                </p>
              )}
              {payable && period === "MONTHLY" && (
                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={renewalConsent}
                    onChange={(e) => setRenewalConsent(e.target.checked)}
                  />
                  Acepto la renovación y el cobro automático mensual del importe
                  indicado hasta que cancele.
                </label>
              )}
              {error && (
                <p role="alert" className="notice-error">
                  {error}
                </p>
              )}
              <div className={s.actions}>
                <button
                  className="primary-button"
                  disabled={
                    busy ||
                    !payable ||
                    Boolean(payable && period === "MONTHLY" && !renewalConsent)
                  }
                  onClick={() => confirm()}
                >
                  {busy ? "Procesando…" : "Pagar con Mercado Pago"}
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Dialog>
        )}
        {trialDialog && (
          <Dialog
            title="Probá Business por 14 días"
            onClose={() => setTrialDialog(false)}
            busy={busy}
          >
            <div className={s.form}>
              <p>
                La prueba comienza ahora y está disponible una sola vez por
                negocio. No requiere tarjeta ni genera cobros. Al finalizar,
                volvés a Free y tus datos se conservan.
              </p>
              {error && (
                <p role="alert" className="notice-error">
                  {error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => subscriptionAction("trial")}
              >
                {busy ? "Activando…" : "Activar mis 14 días gratis"}
              </button>
            </div>
          </Dialog>
        )}
        {cancelDialog && (
          <Dialog
            title="Cancelar renovación mensual"
            onClose={() => setCancelDialog(false)}
            busy={busy}
          >
            <div className={s.form}>
              <p>
                Vamos a cancelar la autorización en Mercado Pago para detener
                los próximos cobros. El período ya pagado se mantiene.
              </p>
              {error && (
                <p role="alert" className="notice-error">
                  {error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => subscriptionAction("cancel")}
              >
                {busy ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </Dialog>
        )}
      </div>
    </main>
  );
}
