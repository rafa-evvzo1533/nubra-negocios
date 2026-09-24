"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Printer,
} from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { api, send, money, date, statusLabels, type Row } from "./client";
import styles from "./BusinessModule.module.css";
type Activity = {
  id: string;
  kind: string;
  description: string;
  created_at: string;
};
const kinds: Record<string, string> = {
  NOTE: "Nota",
  CALL: "Llamada",
  MEETING: "Reunión",
  EMAIL: "Email",
};
export function RecordDetail({
  resource,
  row,
  currency,
  writable,
  onClose,
  onChanged,
}: {
  resource: "customers" | "quotes" | "sales";
  row: Row;
  currency: string;
  writable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<Row>(`${resource}/${row.id}`, { signal: controller.signal }),
      resource === "customers"
        ? api<Activity[]>(`customers/${row.id}/activities`, {
            signal: controller.signal,
          })
        : Promise.resolve([]),
    ])
      .then(([d, a]) => {
        setDetail(d);
        setActivities(a);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [resource, row.id]);
  async function change(action: string, body: unknown) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await send(`${resource}/${row.id}/${action}`, body);
      setDetail(await api<Row>(`${resource}/${row.id}`));
      onChanged();
      setSuccess(
        action === "convert"
          ? "Venta creada. El stock fue actualizado."
          : "Estado actualizado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  async function activity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await send(`customers/${row.id}/activities`, {
        kind: data.get("kind"),
        description: data.get("description"),
      });
      form.reset();
      setActivities(await api<Activity[]>(`customers/${row.id}/activities`));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        resource === "customers"
          ? (row.name ?? "Cliente")
          : `${resource === "quotes" ? "Presupuesto" : "Venta"} #${row.id.slice(0, 8).toUpperCase()}`
      }
      onClose={onClose}
      busy={busy}
      wide={resource !== "customers"}
    >
      <div className={styles.record}>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="notice-success" role="status">
            <Check size={16} />
            {success}
          </p>
        )}
        {resource === "sales" &&
          writable &&
          detail &&
          detail.status !== "CANCELLED" && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "¿Cancelar esta venta y devolver sus unidades al stock? Solo se permiten ventas sin cobros.",
                  )
                )
                  void change("cancel", {});
              }}
            >
              Cancelar venta
            </button>
          )}
        {resource === "sales" && detail?.status === "CANCELLED" && (
          <p className="notice-error">Venta cancelada · stock restituido</p>
        )}
        {!detail ? (
          <div
            aria-label="Cargando detalle"
            className="skeleton"
            style={{ height: 200 }}
          />
        ) : resource === "customers" ? (
          <>
            <div className={styles.contactSummary}>
              <span className={styles.badge}>
                {statusLabels[detail.status ?? "ACTIVE"]}
              </span>
              <p>
                <Mail size={15} />
                {detail.email || "Sin email"}
              </p>
              <p>
                <Phone size={15} />
                {detail.phone || "Sin teléfono"}
              </p>
              <p>
                <Clock size={15} />
                Próximo contacto:{" "}
                {detail.next_contact
                  ? date(detail.next_contact)
                  : "Sin programar"}
              </p>
              {detail.notes && <p className={styles.note}>{detail.notes}</p>}
            </div>
            <h3>Seguimiento del cliente</h3>
            {writable && (
              <form className={styles.form} onSubmit={activity}>
                <fieldset disabled={busy}>
                  <label>
                    Tipo de actividad
                    <select name="kind">
                      {Object.entries(kinds).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Qué pasó
                    <textarea
                      name="description"
                      required
                      maxLength={5000}
                      rows={3}
                      placeholder="Registrá la conversación y los próximos pasos…"
                    />
                  </label>
                </fieldset>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Guardando…" : "Registrar actividad"}
                </button>
              </form>
            )}
            <div className={styles.activityList}>
              {activities.length ? (
                activities.map((a) => (
                  <article key={a.id}>
                    <div>
                      <MessageSquare size={15} />
                      <strong>{kinds[a.kind]}</strong>
                      <small>{date(a.created_at)}</small>
                    </div>
                    <p>{a.description}</p>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <MessageSquare size={28} />
                  <strong>Todavía no hay contactos registrados</strong>
                  <p>
                    Registrá llamadas, reuniones y notas para mantener el
                    seguimiento.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.documentHeading}>
              <div>
                <span className={styles.badge}>
                  {resource === "quotes"
                    ? statusLabels[detail.status ?? "DRAFT"]
                    : "Venta registrada"}
                </span>
                <h3>{detail.customer_name || "Consumidor final"}</h3>
                <p>Creado el {date(detail.created_at)}</p>
                {detail.valid_until && (
                  <p>Válido hasta {date(detail.valid_until)}</p>
                )}
              </div>
              <button
                className="secondary-button"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Imprimir
              </button>
            </div>
            {detail.source === "RECEIPT" && (
              <p className={styles.help}>
                Venta importada · {detail.source_reference} ·{" "}
                <a
                  href={`/api/v1/receipts/${detail.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver comprobante original
                </a>
                . Sin movimiento de stock.
              </p>
            )}
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.price_cents ?? 0, currency)}</td>
                      <td>
                        {money(
                          (item.price_cents ?? 0) * (item.quantity ?? 0),
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.total}>
              <span>Total</span>
              <strong>{money(detail.total_cents ?? 0, currency)}</strong>
            </div>
            {detail.notes && <p className={styles.note}>{detail.notes}</p>}
            {resource === "quotes" && detail.sale_id && (
              <p className={styles.help}>
                Venta asociada: #{detail.sale_id.slice(0, 8).toUpperCase()}
              </p>
            )}
            {resource === "quotes" &&
              writable &&
              detail.status !== "CONVERTED" &&
              detail.status !== "REJECTED" && (
                <div className={styles.quoteActions}>
                  {detail.status === "DRAFT" && (
                    <>
                      <p className={styles.help}>
                        Compartí el presupuesto impreso o en PDF y luego marcalo
                        como enviado.
                      </p>
                      <button
                        disabled={busy}
                        className="primary-button"
                        onClick={() => change("status", { status: "SENT" })}
                      >
                        Marcar como enviado <ArrowRight size={15} />
                      </button>
                    </>
                  )}
                  {detail.status === "SENT" && (
                    <button
                      disabled={busy}
                      className="primary-button"
                      onClick={() => change("status", { status: "ACCEPTED" })}
                    >
                      <Check size={15} /> Marcar como aceptado
                    </button>
                  )}
                  {detail.status === "ACCEPTED" && (
                    <>
                      <p className={styles.help}>
                        Al convertir se creará una venta con los precios
                        cotizados y se descontará el stock.
                      </p>
                      <button
                        disabled={busy}
                        className="primary-button"
                        onClick={() => change("convert", {})}
                      >
                        Convertir en venta <ArrowRight size={15} />
                      </button>
                    </>
                  )}
                  <button
                    disabled={busy}
                    className="secondary-button"
                    onClick={() => change("status", { status: "REJECTED" })}
                  >
                    Marcar como rechazado
                  </button>
                </div>
              )}
          </>
        )}
      </div>
    </Dialog>
  );
}
