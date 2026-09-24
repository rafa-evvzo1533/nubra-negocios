"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "./AccountForms";
import { Dialog } from "../ui/Dialog";
import { PlanCards, formatPrice, type PlanCardData } from "./PlanCards";
import s from "./Foundation.module.css";
type Data = {
  subscription: {
    name: string;
    code: string;
    source: string;
    status: string;
    expires_at: string | null;
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
};
type Order = {
  id: string;
  name: string;
  amount_cents: number;
  currency: string;
  status: string;
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
  const [selected, setSelected] = useState<PlanCardData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [orders, setOrders] = useState<Order[]>([]),
    [revision, setRevision] = useState(0);
  const key = useRef<{ plan: string; id: string } | null>(null);
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
  async function confirm(inquiry = false) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (
        !inquiry &&
        data.billingReady &&
        selected.checkout_enabled &&
        selected.price_cents
      ) {
        if (key.current?.plan !== selected.code)
          key.current = { plan: selected.code, id: crypto.randomUUID() };
        const result = await api("/api/v1/billing/checkout", "POST", {
          plan: selected.code,
          idempotencyKey: key.current.id,
        });
        window.location.assign(result.url);
      } else {
        const result = await api("/api/v1/subscription", "POST", {
          plan: selected.code,
        });
        setMessage(result.message);
        setSelected(null);
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
  return (
    <main className={s.page}>
      <div className={s.content}>
        <nav className={s.actions}>
          <Link className={s.brand} href="/">
            nubra.
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
          onChoose={(p) => {
            setError("");
            setSelected(p);
          }}
          busy={busy}
          canPay={data.billingReady}
          canManage={data.canManage}
        />
        <p className={s.paymentNote}>
          <CreditCard size={18} />
          {data.billingReady
            ? "Pagá de forma segura en Mercado Pago. La acreditación se confirma automáticamente y puede demorar unos minutos."
            : "Los pagos online se habilitarán cuando NUBRA configure los precios y Mercado Pago. Podés enviar una consulta sobre el plan."}{" "}
          {!data.canManage &&
            "Solo los responsables del negocio pueden contratar."}
        </p>
        <section className={s.card}>
          <h2>Beneficios y consumo de tu plan</h2>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Capacidad</th>
                  <th>Uso actual</th>
                  <th>Disponible</th>
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
                        <td>{o.name}</td>
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
            title={payable ? "Confirmá tu contratación" : "Consultar un plan"}
            onClose={() => setSelected(null)}
            busy={busy}
          >
            <div className={s.form}>
              <h3>{selected.name}</h3>
              <p className={s.muted}>
                {payable
                  ? `${formatPrice(selected.price_cents!, selected.currency)} por 30 días. Es un pago único, sin renovación ni débito automático. Vas a continuar en Mercado Pago.`
                  : "Enviaremos una solicitud al equipo de NUBRA. Esta consulta no genera ningún cobro ni cambia tu plan actual."}
              </p>
              {error && (
                <p role="alert" className="notice-error">
                  {error}
                </p>
              )}
              <div className={s.actions}>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => confirm()}
                >
                  {busy
                    ? "Procesando…"
                    : payable
                      ? "Ir a Mercado Pago"
                      : "Enviar consulta"}
                </button>
                {payable && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => confirm(true)}
                  >
                    Solicitar propuesta sin pagar
                  </button>
                )}
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
      </div>
    </main>
  );
}
