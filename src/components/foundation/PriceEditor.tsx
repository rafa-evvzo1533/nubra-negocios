"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "./AccountForms";
import s from "./Foundation.module.css";
export function PriceEditor({
  plan,
  period = "MONTHLY",
}: {
  plan: {
    code: string;
    price_cents: number | null;
    checkout_enabled: boolean;
    annual_price_cents?: number | null;
    annual_checkout_enabled?: boolean;
  };
  period?: "MONTHLY" | "YEARLY";
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/internal/admin/prices", "PATCH", {
        plan: plan.code,
        period,
        priceCents: f.get("price")
          ? Math.round(Number(f.get("price")) * 100)
          : null,
        currency: "ARS",
        enabled: f.get("enabled") === "on",
      });
      setMessage(
        "Precio guardado. Los pedidos ya iniciados conservan su importe.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={`${s.form} ${s.priceEditor}`} onSubmit={save}>
      <h3>Precio {period === "YEARLY" ? "anual" : "mensual"} y pago online</h3>
      <div className={s.grid}>
        <label>
          Precio en ARS · {period === "YEARLY" ? "año completo" : "mes"}
          <input
            name="price"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            defaultValue={
              (period === "YEARLY" ? plan.annual_price_cents : plan.price_cents)
                ? Number(
                    period === "YEARLY"
                      ? plan.annual_price_cents
                      : plan.price_cents,
                  ) / 100
                : ""
            }
            placeholder="A definir"
          />
        </label>
        <label className={s.check}>
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={
              period === "YEARLY"
                ? plan.annual_checkout_enabled
                : plan.checkout_enabled
            }
          />
          Habilitar compra {period === "YEARLY" ? "anual" : "mensual"}
        </label>
      </div>
      <p>
        El pago también requiere credenciales de Mercado Pago configuradas en el
        servidor. Los precios vacíos se muestran como «Consultar».
      </p>
      <button className="primary-button" disabled={busy}>
        Guardar precio
      </button>
      {message && (
        <p className="notice-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
