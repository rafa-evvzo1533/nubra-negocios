"use client";
import { useState, type FormEvent } from "react";
import { Camera, Package, Trash2, LoaderCircle, X } from "lucide-react";
import type { Resource } from "@/server/permissions";
import { Dialog } from "../ui/Dialog";
import { EntityPicker } from "./EntityPicker";
import { money, send, type Row } from "./client";
import styles from "./BusinessModule.module.css";
import { PhotoSale } from "../operations/PhotoSale";

type CartLine = { product: Row; quantity: number };
const titles: Record<Resource, string> = {
  customers: "Nuevo cliente",
  products: "Nuevo producto",
  sales: "Nueva venta",
  inventory: "Movimiento de stock",
  quotes: "Nuevo presupuesto",
};
export function Composer({
  resource,
  editing,
  currency,
  onClose,
  onSaved,
}: {
  resource: Resource;
  editing?: Row;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photoMode, setPhotoMode] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [product, setProduct] = useState<Row | null>(null);
  const [showCustomer, setShowCustomer] = useState(false);
  const commercial = resource === "sales" || resource === "quotes";
  const total = cart.reduce(
    (sum, line) => sum + (line.product.price_cents ?? 0) * line.quantity,
    0,
  );
  function add(p: Row) {
    setCart((current) => {
      const existing = current.find((i) => i.product.id === p.id);
      return existing
        ? current.map((i) =>
            i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...current, { product: p, quantity: 1 }];
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const val = (key: string) => String(data.get(key) ?? "");
    let body: unknown;
    if (resource === "customers")
      body = {
        name: val("name"),
        email: val("email"),
        phone: val("phone"),
        notes: val("notes"),
        status: val("status"),
        nextContact: val("nextContact"),
      };
    else if (resource === "products")
      body = {
        name: val("name"),
        sku: val("sku"),
        priceCents: Math.round(Number(val("price")) * 100),
        minimumStock: Number(val("minimumStock")),
      };
    else if (resource === "inventory") {
      if (!product) {
        setError("Seleccioná un producto.");
        return;
      }
      body = {
        productId: product.id,
        quantity: Number(val("quantity")),
        reason: val("reason"),
      };
    } else {
      if (!cart.length) {
        setError("Agregá al menos un producto.");
        return;
      }
      if (
        cart.length > 100 ||
        cart.some(
          (i) =>
            !Number.isInteger(i.quantity) ||
            i.quantity < 1 ||
            i.quantity > 1000000,
        )
      ) {
        setError("Revisá las cantidades del carrito.");
        return;
      }
      if (
        resource === "sales" &&
        cart.some((i) => i.quantity > (i.product.stock ?? 0))
      ) {
        setError("La cantidad supera el stock disponible.");
        return;
      }
      body = {
        ...(customer ? { customerId: customer.id } : {}),
        ...(resource === "sales" ? { idempotencyKey } : {}),
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        ...(resource === "quotes"
          ? { validUntil: val("validUntil"), notes: val("notes") }
          : {}),
      };
    }
    setBusy(true);
    try {
      await send(
        `${resource}${editing ? `/${editing.id}` : ""}`,
        body,
        editing ? "PUT" : "POST",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  if (resource === "sales" && photoMode)
    return <PhotoSale onClose={onClose} onSaved={onSaved} />;
  return (
    <Dialog
      title={editing ? "Editar registro" : titles[resource]}
      onClose={onClose}
      busy={busy}
      wide={commercial}
    >
      {resource === "sales" && (
        <button
          type="button"
          className="secondary-button"
          style={{ marginBottom: 20 }}
          onClick={() => setPhotoMode(true)}
        >
          <Camera size={18} /> Sacar foto o subir boleta
        </button>
      )}
      <form className={styles.form} onSubmit={submit}>
        <fieldset disabled={busy}>
          {(resource === "customers" || resource === "products") && (
            <label>
              Nombre
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={editing?.name}
                placeholder={
                  resource === "customers"
                    ? "Nombre del cliente o empresa"
                    : "Nombre del producto"
                }
              />
            </label>
          )}
          {resource === "customers" && (
            <>
              <div className={styles.formGrid}>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    defaultValue={editing?.email}
                    placeholder="nombre@empresa.com"
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    name="phone"
                    maxLength={40}
                    defaultValue={editing?.phone}
                    placeholder="Código de área y número"
                  />
                </label>
              </div>
              <div className={styles.formGrid}>
                <label>
                  Estado
                  <select
                    name="status"
                    defaultValue={editing?.status ?? "ACTIVE"}
                  >
                    <option value="LEAD">Potencial</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </label>
                <label>
                  Próximo contacto
                  <input
                    type="date"
                    name="nextContact"
                    defaultValue={editing?.next_contact ?? ""}
                  />
                </label>
              </div>
              <label>
                Notas
                <textarea
                  name="notes"
                  maxLength={5000}
                  defaultValue={editing?.notes}
                  placeholder="Información útil para tu equipo…"
                  rows={4}
                />
              </label>
            </>
          )}
          {resource === "products" && (
            <>
              <label>
                SKU
                <input
                  name="sku"
                  maxLength={80}
                  required
                  defaultValue={editing?.sku}
                  placeholder="Código único del producto"
                />
              </label>
              <div className={styles.formGrid}>
                <label>
                  Precio ({currency})
                  <input
                    name="price"
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    defaultValue={
                      editing ? Number(editing.price_cents) / 100 : undefined
                    }
                  />
                </label>
                <label>
                  Stock mínimo
                  <input
                    name="minimumStock"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    required
                    defaultValue={editing?.minimum_stock ?? 0}
                  />
                </label>
              </div>
              <p className={styles.help}>
                Registrá las entradas y salidas de unidades desde Inventario.
              </p>
            </>
          )}
          {commercial && (
            <>
              <div className={styles.formSection}>
                <h3>Cliente</h3>
                {customer ? (
                  <div className={styles.selected}>
                    <span>{customer.name}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setCustomer(null)}
                      aria-label="Quitar cliente"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowCustomer(!showCustomer)}
                  >
                    {showCustomer
                      ? "Cerrar búsqueda"
                      : "Seleccionar cliente (opcional)"}
                  </button>
                )}
                {!customer && showCustomer && (
                  <EntityPicker
                    resource="customers"
                    onSelect={(p) => {
                      setCustomer(p);
                      setShowCustomer(false);
                    }}
                  />
                )}
              </div>
              <div className={styles.formSection}>
                <h3>Productos</h3>
                <EntityPicker resource="products" onSelect={add} />
              </div>
              <div className={styles.cart}>
                {cart.length ? (
                  cart.map((line) => (
                    <div className={styles.cartLine} key={line.product.id}>
                      <div>
                        <strong>{line.product.name}</strong>
                        <small>
                          {money(line.product.price_cents ?? 0, currency)} por
                          unidad · stock {line.product.stock}
                        </small>
                      </div>
                      <input
                        type="number"
                        aria-label={`Cantidad de ${line.product.name}`}
                        min="1"
                        max={
                          resource === "sales"
                            ? Math.min(line.product.stock ?? 0, 1000000)
                            : 1000000
                        }
                        step="1"
                        required
                        value={line.quantity || ""}
                        onChange={(e) =>
                          setCart((current) =>
                            current.map((i) =>
                              i.product.id === line.product.id
                                ? { ...i, quantity: Number(e.target.value) }
                                : i,
                            ),
                          )
                        }
                      />
                      <strong>
                        {money(
                          (line.product.price_cents ?? 0) * line.quantity,
                          currency,
                        )}
                      </strong>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Quitar ${line.product.name}`}
                        onClick={() =>
                          setCart((current) =>
                            current.filter(
                              (i) => i.product.id !== line.product.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Package size={26} />
                    <p>
                      Agregá productos para armar{" "}
                      {resource === "sales" ? "tu venta" : "el presupuesto"}.
                    </p>
                  </div>
                )}
              </div>
              {resource === "quotes" && (
                <>
                  <label>
                    Válido hasta
                    <input name="validUntil" type="date" />
                  </label>
                  <label>
                    Observaciones
                    <textarea
                      name="notes"
                      maxLength={5000}
                      rows={3}
                      placeholder="Condiciones del presupuesto…"
                    />
                  </label>
                </>
              )}
              <div className={styles.total}>
                <span>Total estimado</span>
                <strong>{money(total, currency)}</strong>
              </div>
              <p className={styles.help}>
                {resource === "quotes"
                  ? "El presupuesto guarda los precios y no reserva ni descuenta stock."
                  : "El importe final usa los precios vigentes al confirmar la venta."}
              </p>
            </>
          )}
          {resource === "inventory" && (
            <>
              <h3>Producto</h3>
              {product ? (
                <div className={styles.selected}>
                  <span>
                    {product.name} · stock {product.stock}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Cambiar producto"
                    onClick={() => setProduct(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <EntityPicker resource="products" onSelect={setProduct} />
              )}
              <label>
                Cantidad
                <input
                  name="quantity"
                  type="number"
                  min="-1000000"
                  max="1000000"
                  step="1"
                  required
                  placeholder="Ej.: 10 para entrada, -2 para salida"
                />
              </label>
              <label>
                Motivo
                <input
                  name="reason"
                  maxLength={240}
                  required
                  placeholder="Compra, ajuste, devolución…"
                />
              </label>
              <p className={styles.help}>
                Usá una cantidad positiva para entradas y negativa para salidas.
              </p>
            </>
          )}
        </fieldset>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        <footer className={styles.formFooter}>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spinner" />}
            {busy
              ? "Guardando…"
              : resource === "sales"
                ? "Confirmar venta"
                : resource === "quotes"
                  ? "Guardar presupuesto"
                  : "Guardar cambios"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
