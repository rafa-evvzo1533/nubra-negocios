"use client";
import { displayLabel } from "@/domain/display";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../foundation/AccountForms";
import { notify, confirmAction } from "../ui/Notifications";
import { PageHeader } from "../ui/PageHeader";
import { Dialog } from "../ui/Dialog";
import { EntityPicker } from "../business/EntityPicker";
import { money, date, type Row } from "../business/client";
import s from "../foundation/Foundation.module.css";
type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  category: string;
  notes: string;
  active: boolean;
};
type Account = {
  id: string;
  name: string;
  phone: string;
  total_cents: string;
  paid_cents: string;
  balance_cents: string;
};
type Report = {
  totals: { sales: number; total_cents: string };
  payments: { method: string; amount_cents: string }[];
  products: {
    id: string;
    name: string;
    units: number;
    revenue_cents: string;
    gross_margin_cents: string;
  }[];
};
export type CommerceSection =
  "suppliers" | "accounts" | "reports" | "pos" | "audit";
const labels = {
  suppliers: "Proveedores",
  accounts: "Cuenta corriente",
  reports: "Reportes",
  pos: "Venta rápida",
  audit: "Historial de actividad",
};
const methods = [
  ["CASH", "Efectivo"],
  ["TRANSFER", "Transferencia"],
  ["CARD", "Tarjeta"],
  ["OTHER", "Otro"],
];
export function CommerceView({
  section,
  currency,
  permissions,
}: {
  section: CommerceSection;
  currency: string;
  permissions: string[];
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [customers, setCustomers] = useState<Account[]>([]),
    [events, setEvents] = useState<Record<string, string>[]>([]),
    [report, setReport] = useState<Report | null>(null),
    [editing, setEditing] = useState<Supplier | null | undefined>(),
    [collect, setCollect] = useState<Account | null>(null),
    [detail, setDetail] = useState<Account | null>(null),
    [sales, setSales] = useState<Account[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    if (section === "pos" || section === "reports") return;
    api("/api/v1/commerce/" + section)
      .then((d) => {
        if (!active) return;
        if (section === "suppliers") setSuppliers(d);
        else if (section === "accounts") setCustomers(d.customers);
        else setEvents(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [section, revision]);
  async function mutate(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      setEditing(undefined);
      setCollect(null);
      setRevision((v) => v + 1);
      notify("Cambios guardados correctamente.");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(
      "/api/v1/commerce/suppliers" + (editing ? "?id=" + editing.id : ""),
      Object.fromEntries(f),
      editing ? "PUT" : "POST",
    );
  }
  async function loadReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      setReport(
        await api(
          "/api/v1/commerce/reports?" +
            new URLSearchParams({
              from: String(f.get("from")),
              to: String(f.get("to")),
            }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={labels[section]}
        description={
          section === "accounts"
            ? "Saldos derivados de ventas y cobros. Registrá pagos sin duplicar deudas."
            : section === "pos"
              ? "Vendé, actualizá stock y registrá el cobro en un solo paso."
              : "Datos de tu negocio, con permisos y trazabilidad."
        }
        actions={
          section === "suppliers" && permissions.includes("suppliers.write") ? (
            <button className="primary-button" onClick={() => setEditing(null)}>
              Nuevo proveedor
            </button>
          ) : undefined
        }
      />
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {section === "pos" ? (
        <PointOfSale
          currency={currency}
          canPay={permissions.includes("cash.write")}
        />
      ) : (
        <section className={s.card}>
          {["suppliers", "accounts"].includes(section) && (
            <label className={s.form}>
              Buscar
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, contacto o categoría"
              />
            </label>
          )}
          {section === "suppliers" && (
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Contacto</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers
                    .filter((v) =>
                      (v.name + " " + v.phone + " " + v.category)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>
                          {v.phone}
                          <br />
                          {v.email}
                        </td>
                        <td>{v.category || "—"}</td>
                        <td>{v.active ? "Activo" : "Archivado"}</td>
                        <td>
                          {permissions.includes("suppliers.write") && (
                            <div className={s.actions}>
                              <button
                                className="secondary-button"
                                onClick={() => setEditing(v)}
                              >
                                Editar
                              </button>
                              {v.active && (
                                <button
                                  className="secondary-button"
                                  disabled={busy}
                                  onClick={async () => {
                                    if (
                                      await confirmAction(
                                        "¿Archivar este proveedor? Se conservarán sus referencias en productos.",
                                      )
                                    )
                                      await mutate(
                                        "/api/v1/commerce/suppliers?id=" + v.id,
                                        undefined,
                                        "DELETE",
                                      );
                                  }}
                                >
                                  Archivar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!suppliers.length && (
                <p>
                  Agregá tu primer proveedor para relacionarlo con los
                  productos.
                </p>
              )}
            </div>
          )}
          {section === "accounts" && (
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Vendido</th>
                    <th>Cobrado</th>
                    <th>Saldo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((v) =>
                      (v.name + " " + v.phone)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{money(c.total_cents, currency)}</td>
                        <td>{money(c.paid_cents, currency)}</td>
                        <td>{money(c.balance_cents, currency)}</td>
                        <td>
                          <div className={s.actions}>
                            <button
                              className="secondary-button"
                              onClick={async () => {
                                try {
                                  const r = await api(
                                    "/api/v1/commerce/accounts?customerId=" +
                                      c.id,
                                  );
                                  setSales(r.sales);
                                  setDetail(c);
                                } catch (e) {
                                  setError(
                                    e instanceof Error ? e.message : "Error",
                                  );
                                }
                              }}
                            >
                              Ver ventas
                            </button>
                            {Number(c.balance_cents) > 0 &&
                              permissions.includes("accounts.write") &&
                              permissions.includes("cash.write") && (
                                <button
                                  className="primary-button"
                                  onClick={() => setCollect(c)}
                                >
                                  Registrar cobro
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!customers.length && (
                <p>
                  Los clientes y sus saldos aparecerán cuando registres ventas.
                </p>
              )}
            </div>
          )}
          {section === "reports" && (
            <>
              <form className={s.form} onSubmit={loadReport}>
                <div className={s.grid}>
                  <label>
                    Desde
                    <input
                      name="from"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 8) + "01"}
                      required
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      name="to"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                </div>
                <button disabled={busy} className="primary-button">
                  Consultar período
                </button>
              </form>
              {report && (
                <>
                  <h2 style={{ marginTop: 28 }}>
                    {report.totals.sales} ventas ·{" "}
                    {money(report.totals.total_cents, currency)}
                  </h2>
                  <p>
                    Importes de ventas confirmadas. Los cobros se agrupan por su
                    fecha de ingreso.
                  </p>
                  <div className={s.grid}>
                    {report.payments.map((p) => (
                      <div className={s.roleCard} key={p.method}>
                        {methods.find((m) => m[0] === p.method)?.[1]}
                        <h3>{money(p.amount_cents, currency)}</h3>
                      </div>
                    ))}
                  </div>
                  <h3>Productos más vendidos</h3>
                  <p>
                    El margen usa el costo guardado al vender; no incluye gastos
                    ni impuestos. Las ventas anteriores a incorporar costos usan
                    costo cero.
                  </p>
                  <div className={s.scroll}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Unidades</th>
                          <th>Vendido</th>
                          <th>Margen bruto estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.products.map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{p.units}</td>
                            <td>{money(p.revenue_cents, currency)}</td>
                            <td>{money(p.gross_margin_cents, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
          {section === "audit" && (
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Persona</th>
                    <th>Acción</th>
                    <th>Recurso</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{date(e.created_at)}</td>
                      <td>{e.actor ?? "Sistema"}</td>
                      <td>{displayLabel(e.action)}</td>
                      <td>{e.entity_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Últimos 200 eventos del negocio. No incluye secretos ni
                contenido de registros.
              </p>
            </div>
          )}
        </section>
      )}
      {editing !== undefined && (
        <Dialog
          title={editing ? "Editar proveedor" : "Nuevo proveedor"}
          busy={busy}
          onClose={() => setEditing(undefined)}
        >
          <form className={s.form} onSubmit={save}>
            {[
              ["name", "Nombre", 120],
              ["email", "Email", 320],
              ["phone", "Teléfono", 40],
              ["category", "Categoría", 80],
            ].map(([key, label, max]) => (
              <label key={key}>
                {label}
                <input
                  name={String(key)}
                  type={key === "email" ? "email" : "text"}
                  required={key === "name"}
                  maxLength={Number(max)}
                  defaultValue={
                    (editing?.[key as keyof Supplier] as string) ?? ""
                  }
                />
              </label>
            ))}
            <label>
              Notas
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={editing?.notes}
              />
            </label>
            {error && (
              <p role="alert" className="notice-error">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              Guardar proveedor
            </button>
          </form>
        </Dialog>
      )}
      {collect && (
        <CollectionDialog
          customer={collect}
          currency={currency}
          onClose={() => setCollect(null)}
          onSaved={() => {
            setCollect(null);
            setRevision((v) => v + 1);
          }}
        />
      )}
      {detail && (
        <Dialog
          title={"Cuenta de " + detail.name}
          onClose={() => setDetail(null)}
          wide
        >
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((v) => (
                  <tr key={v.id}>
                    <td>{v.id.slice(0, 8)}</td>
                    <td>{money(v.total_cents, currency)}</td>
                    <td>{money(v.paid_cents, currency)}</td>
                    <td>{money(v.balance_cents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog>
      )}
    </>
  );
}
function CollectionDialog({
  customer,
  currency,
  onClose,
  onSaved,
}: {
  customer: Account;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog title={"Cobrar a " + customer.name} onClose={onClose} busy={busy}>
      <p>
        Saldo: {money(customer.balance_cents, currency)}. El cobro se aplica
        primero a las ventas más antiguas.
      </p>
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api("/api/v1/commerce/accounts", "POST", {
              customerId: customer.id,
              amountCents: Math.round(Number(f.get("amount")) * 100),
              method: f.get("method"),
              idempotencyKey: key,
            });
            notify("Cobro registrado y saldo actualizado.");
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Importe
          <input
            name="amount"
            type="number"
            required
            min="0.01"
            max={Number(customer.balance_cents) / 100}
            step="0.01"
          />
        </label>
        <label>
          Medio
          <select name="method">
            {methods.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary-button">
          Registrar cobro
        </button>
      </form>
    </Dialog>
  );
}
function PointOfSale({
  currency,
  canPay,
}: {
  currency: string;
  canPay: boolean;
}) {
  const [cart, setCart] = useState<{ product: Row; quantity: number }[]>([]),
    [customer, setCustomer] = useState<Row | null>(null),
    [partial, setPartial] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const total = cart.reduce(
    (n, i) => n + Number(i.product.price_cents) * i.quantity,
    0,
  );
  return (
    <section className={s.card}>
      <div className={s.grid}>
        <div>
          <h2>Agregar productos</h2>
          <EntityPicker
            resource="products"
            onSelect={(p) =>
              setCart((v) =>
                v.some((i) => i.product.id === p.id)
                  ? v.map((i) =>
                      i.product.id === p.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i,
                    )
                  : [...v, { product: p, quantity: 1 }],
              )
            }
          />
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((i) => (
                  <tr key={i.product.id}>
                    <td>{i.product.name}</td>
                    <td>
                      <input
                        style={{ width: 75 }}
                        aria-label={"Cantidad " + i.product.name}
                        type="number"
                        min={1}
                        max={i.product.stock}
                        value={i.quantity}
                        onChange={(e) =>
                          setCart((v) =>
                            v.map((l) =>
                              l.product.id === i.product.id
                                ? { ...l, quantity: Number(e.target.value) }
                                : l,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      {money(
                        Number(i.product.price_cents) * i.quantity,
                        currency,
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary-button"
                        aria-label={"Quitar " + i.product.name}
                        onClick={() =>
                          setCart((v) =>
                            v.filter((l) => l.product.id !== i.product.id),
                          )
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!cart.length && <p>Buscá un producto para comenzar.</p>}
        </div>
        <form
          className={s.form}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("/api/v1/commerce/pos", "POST", {
                idempotencyKey: key,
                customerId: customer?.id ?? null,
                items: cart.map((i) => ({
                  productId: i.product.id,
                  quantity: i.quantity,
                })),
                paidCents: canPay
                  ? partial
                    ? Math.round(Number(f.get("paid")) * 100)
                    : total
                  : 0,
                method: f.get("method") ?? "CASH",
              });
              setCart([]);
              setCustomer(null);
              setKey(crypto.randomUUID());
              notify("Venta registrada. Stock, cobro y saldo actualizados.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Total: {money(total, currency)}</h2>
          <label>Cliente (opcional si se paga el total)</label>
          {customer ? (
            <div className={s.actions}>
              {customer.name}
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCustomer(null)}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <EntityPicker resource="customers" onSelect={setCustomer} />
          )}
          {canPay ? (
            <>
              <label>
                Medio de pago
                <select name="method">
                  {methods.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={partial}
                  onChange={(e) => setPartial(e.target.checked)}
                />
                Cobro parcial o cuenta corriente
              </label>
              {partial && (
                <label>
                  Importe cobrado
                  <input
                    name="paid"
                    type="number"
                    min={0}
                    max={total / 100}
                    step="0.01"
                    defaultValue={0}
                    required
                  />
                </label>
              )}
              <p>Los cobros en efectivo requieren una caja abierta.</p>
            </>
          ) : (
            <p>
              Tu rol no registra cobros. La venta quedará pendiente a nombre del
              cliente seleccionado.
            </p>
          )}
          {error && (
            <p className="notice-error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy || !cart.length} className="primary-button">
            {busy ? "Guardando…" : "Confirmar venta"}
          </button>
        </form>
      </div>
    </section>
  );
}
