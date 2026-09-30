"use client";
import { notify } from "../ui/Notifications";
import { useEffect, useState, type FormEvent } from "react";
import { api, send, money, date } from "../business/client";
import styles from "../business/BusinessModule.module.css";
type Sale = {
  id: string;
  total_cents: string;
  paid_cents: string;
  balance_cents: string;
  customer_name?: string;
  source: string;
};
type Payment = {
  id: string;
  sale_id: string;
  amount_cents: string;
  method: string;
  reference: string;
  created_at: string;
};
type Cash = {
  id: string;
  opening_cents: string;
  balance_cents: string;
  closed_at: string | null;
  counted_cents: string | null;
  expected_cents: string | null;
  opened_at: string;
};
type Movement = {
  id: string;
  amount_cents: string;
  reason: string;
  created_at: string;
};
type Summary = {
  sales: Sale[];
  payments: Payment[];
  cash: Cash[];
  movements: Movement[];
};
const methods: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
};
export function FinanceView({
  currency,
  writable,
}: {
  currency: string;
  writable: boolean;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);
  const [paymentKey, setPaymentKey] = useState("");
  const [movementKey, setMovementKey] = useState("");
  const [saleId, setSaleId] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Summary>("finance", { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function submit(
    e: FormEvent<HTMLFormElement>,
    action: "payment" | "open" | "close" | "movement",
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    const cents = (name: string) => Math.round(Number(f.get(name)) * 100);
    const open = data?.cash.find((c) => !c.closed_at);
    try {
      if (action === "payment") {
        const key = paymentKey || crypto.randomUUID();
        setPaymentKey(key);
        await send("payments", {
          saleId,
          amountCents: cents("amount"),
          method: f.get("method"),
          reference: f.get("reference"),
          idempotencyKey: key,
        });
        setPaymentKey("");
        setSaleId("");
      } else if (action === "open")
        await send("cash", { action, openingCents: cents("opening") });
      else if (action === "close")
        await send("cash", {
          action,
          sessionId: open?.id,
          countedCents: cents("counted"),
        });
      else {
        const key = movementKey || crypto.randomUUID();
        setMovementKey(key);
        await send("cash", {
          action,
          sessionId: open?.id,
          amountCents: cents("amount"),
          reason: f.get("reason"),
          idempotencyKey: key,
        });
        setMovementKey("");
      }
      form.reset();
      setRevision((v) => v + 1);
      notify("Operación registrada correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  const open = data?.cash.find((c) => !c.closed_at);
  const selected = data?.sales.find((s) => s.id === saleId);
  return (
    <section className={styles.module}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>CONTROL FINANCIERO</span>
          <h1>Pagos y caja</h1>
          <p>Las ventas, los cobros y el efectivo se registran por separado.</p>
        </div>
      </div>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}

      {!data ? (
        <p>Cargando movimientos…</p>
      ) : (
        <>
          <div className={styles.formGrid}>
            <article className={styles.listPanel} style={{ padding: 20 }}>
              <h2>Caja {open ? "abierta" : "cerrada"}</h2>
              <p>
                Efectivo disponible:{" "}
                <strong>{money(open?.balance_cents ?? 0, currency)}</strong>
              </p>
              {writable &&
                (open ? (
                  <>
                    <form
                      className={styles.form}
                      onSubmit={(e) => submit(e, "movement")}
                    >
                      <fieldset disabled={busy}>
                        <label>
                          Entrada / salida ({currency})
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            required
                            min="-10000000000"
                            max="10000000000"
                            placeholder="Negativo para una salida"
                          />
                        </label>
                        <label>
                          Motivo
                          <input
                            name="reason"
                            required
                            minLength={3}
                            maxLength={240}
                          />
                        </label>
                      </fieldset>
                      <button className="secondary-button" disabled={busy}>
                        Registrar movimiento
                      </button>
                    </form>
                    <form
                      className={styles.form}
                      style={{ marginTop: 24 }}
                      onSubmit={(e) => submit(e, "close")}
                    >
                      <label>
                        Efectivo contado al cierre
                        <input
                          name="counted"
                          type="number"
                          step="0.01"
                          min="0"
                          max="10000000000"
                          required
                          disabled={busy}
                        />
                      </label>
                      <p className={styles.help}>
                        El cierre conserva el saldo esperado y la diferencia con
                        el efectivo contado.
                      </p>
                      <button className="primary-button" disabled={busy}>
                        Confirmar cierre de caja
                      </button>
                    </form>
                  </>
                ) : (
                  <form
                    className={styles.form}
                    onSubmit={(e) => submit(e, "open")}
                  >
                    <label>
                      Efectivo inicial
                      <input
                        name="opening"
                        type="number"
                        step="0.01"
                        min="0"
                        max="10000000000"
                        defaultValue="0"
                        required
                        disabled={busy}
                      />
                    </label>
                    <button className="primary-button" disabled={busy}>
                      Abrir caja
                    </button>
                  </form>
                ))}
            </article>
            <article className={styles.listPanel} style={{ padding: 20 }}>
              <h2>Registrar cobro</h2>
              {writable ? (
                <form
                  className={styles.form}
                  onSubmit={(e) => submit(e, "payment")}
                >
                  <fieldset disabled={busy}>
                    <label>
                      Venta con saldo pendiente
                      <select
                        required
                        value={saleId}
                        onChange={(e) => setSaleId(e.target.value)}
                      >
                        <option value="">Seleccionar venta</option>
                        {data.sales
                          .filter((s) => Number(s.balance_cents) > 0)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              #{s.id.slice(0, 8)} ·{" "}
                              {s.customer_name || "Consumidor final"} ·{" "}
                              {money(s.balance_cents, currency)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Importe a cobrar
                      <input
                        name="amount"
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        max={
                          selected
                            ? Number(selected.balance_cents) / 100
                            : 10000000000
                        }
                      />
                    </label>
                    <label>
                      Medio de pago
                      <select name="method">
                        {Object.entries(methods).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Referencia
                      <input name="reference" maxLength={160} />
                    </label>
                  </fieldset>
                  <button className="primary-button" disabled={busy || !saleId}>
                    Registrar cobro
                  </button>
                </form>
              ) : (
                <p>Tu rol permite consultar los cobros.</p>
              )}
            </article>
          </div>
          <h2 style={{ margin: "28px 0 12px" }}>
            Ventas y saldos · últimas 100
          </h2>
          <div className={`${styles.listPanel} ${styles.table}`}>
            <table>
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Total</th>
                  <th>Cobrado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      #{s.id.slice(0, 8)}
                      <small> · {s.customer_name || "Consumidor final"}</small>
                    </td>
                    <td>{money(s.total_cents, currency)}</td>
                    <td>{money(s.paid_cents, currency)}</td>
                    <td>{money(s.balance_cents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.sales.length && (
              <div className="empty-state">No hay ventas registradas.</div>
            )}
          </div>
          <h2 style={{ margin: "28px 0 12px" }}>Últimos cobros</h2>
          <div className={`${styles.listPanel} ${styles.table}`}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Venta</th>
                  <th>Medio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{date(p.created_at)}</td>
                    <td>
                      #{p.sale_id.slice(0, 8)} · {p.reference}
                    </td>
                    <td>{methods[p.method]}</td>
                    <td>{money(p.amount_cents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 style={{ margin: "28px 0 12px" }}>Movimientos de efectivo</h2>
          <div className={`${styles.listPanel} ${styles.table}`}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{date(m.created_at)}</td>
                    <td>{m.reason}</td>
                    <td>{money(m.amount_cents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 style={{ margin: "28px 0 12px" }}>Historial de cierres</h2>
          <div className={`${styles.listPanel} ${styles.table}`}>
            <table>
              <thead>
                <tr>
                  <th>Cierre</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {data.cash
                  .filter((c) => c.closed_at)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{date(c.closed_at!)}</td>
                      <td>{money(c.expected_cents ?? 0, currency)}</td>
                      <td>{money(c.counted_cents ?? 0, currency)}</td>
                      <td>
                        {money(
                          Number(c.counted_cents) - Number(c.expected_cents),
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
