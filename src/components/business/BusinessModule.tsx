"use client";
import { notify } from "../ui/Notifications";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  PenLine,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { Resource } from "@/server/permissions";
import { Dialog } from "../ui/Dialog";
import { PageHeader } from "../ui/PageHeader";
import { Composer } from "./Composer";
import { RecordDetail } from "./RecordDetail";
import {
  api,
  date,
  money,
  statusLabels,
  type PageData,
  type Row,
} from "./client";
import styles from "./BusinessModule.module.css";
const titles: Record<Resource, string> = {
  customers: "Clientes",
  products: "Productos",
  sales: "Ventas",
  inventory: "Inventario",
  quotes: "Presupuestos",
};
const descriptions: Record<Resource, string> = {
  customers: "Cada relación cuenta. Conocé y acompañá a tus clientes.",
  products: "Tu catálogo, organizado y siempre a mano.",
  sales: "De la primera venta al próximo gran paso.",
  inventory: "Seguí cada entrada y salida de tu negocio.",
  quotes: "Transformá nuevas oportunidades en ventas.",
};
const createLabels: Record<Resource, string> = {
  customers: "Nuevo cliente",
  products: "Nuevo producto",
  sales: "Nueva venta",
  inventory: "Registrar movimiento",
  quotes: "Nuevo presupuesto",
};
const filters: Record<Resource, [string, string][]> = {
  customers: [
    ["all", "Todos los clientes"],
    ["LEAD", "Potenciales"],
    ["ACTIVE", "Activos"],
    ["INACTIVE", "Inactivos"],
    ["due", "Seguimiento pendiente"],
  ],
  products: [
    ["all", "Todos los productos"],
    ["low", "Stock bajo"],
  ],
  sales: [["all", "Todas las ventas"]],
  inventory: [
    ["all", "Todos los movimientos"],
    ["in", "Entradas"],
    ["out", "Salidas"],
  ],
  quotes: [
    ["all", "Todos los estados"],
    ...["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED"].map(
      (s) => [s, statusLabels[s]] as [string, string],
    ),
  ],
};
export function BusinessModule({
  resource,
  writable,
  exportable = false,
  canReadSuppliers = false,
  currency,
  onChanged,
  initialSearch = "",
  initialFilter = "all",
  initialOpen = false,
}: {
  resource: Resource;
  writable: boolean;
  exportable?: boolean;
  canReadSuppliers?: boolean;
  currency: string;
  onChanged: () => void;
  initialSearch?: string;
  initialFilter?: string;
  initialOpen?: boolean;
}) {
  const [query, setQuery] = useState(initialSearch);
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: PageData;
    error?: string;
  } | null>(null);
  const [compose, setCompose] = useState(initialOpen);
  const [editing, setEditing] = useState<Row | undefined>();
  const [view, setView] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const key = JSON.stringify([resource, query, filter, page, revision]);
  const loading = result?.key !== key;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<PageData>(
        `${resource}?paginated=1&page=${page}&pageSize=12&q=${encodeURIComponent(query)}&filter=${filter}`,
        { signal: controller.signal },
      )
        .then((data) => setResult({ key, data }))
        .catch((e) => {
          if (!controller.signal.aborted) setResult({ key, error: e.message });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, resource, query, filter, page]);
  function changed() {
    setRevision((v) => v + 1);
    onChanged();
  }
  function saved() {
    setCompose(false);
    setEditing(undefined);
    setPage(1);
    notify("Cambios guardados correctamente.");
    changed();
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api(`${resource}/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setPage(1);
      notify("Registro eliminado.");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  const data = loading ? undefined : result?.data;
  const rows = data?.items ?? [];
  const editable = resource === "customers" || resource === "products";
  const details =
    resource === "customers" || resource === "sales" || resource === "quotes";
  return (
    <section className={styles.module}>
      {error && !deleting && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <PageHeader
        title={titles[resource]}
        description={descriptions[resource]}
        eyebrow="TU NEGOCIO"
        actions={
          writable && (
            <button
              className="primary-button"
              onClick={() => {
                setEditing(undefined);
                setCompose(true);
              }}
            >
              <Plus size={17} />
              {createLabels[resource]}
            </button>
          )
        }
      />

      <div className={styles.listPanel}>
        {exportable && resource !== "quotes" && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch(`/api/v1/exports/${resource}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!response.ok)
                  throw new Error((await response.json()).error);
                const url = URL.createObjectURL(await response.blob());
                const link = document.createElement("a");
                link.href = url;
                link.download = `nubra-${resource}.csv`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo exportar",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Exportar CSV
          </button>
        )}
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Search size={17} />
            <input
              aria-label={`Buscar en ${titles[resource]}`}
              value={query}
              maxLength={120}
              placeholder={
                resource === "products"
                  ? "Buscar producto o SKU…"
                  : resource === "customers"
                    ? "Buscar nombre, email o teléfono…"
                    : "Buscar por referencia o nombre…"
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <label className={styles.filter}>
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filtrar registros"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              {filters[resource].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <div
            className={styles.loading}
            role="status"
            aria-label="Cargando registros"
          >
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 54 }} />
            ))}
          </div>
        ) : result?.error ? (
          <div className="empty-state">
            <p role="alert">{result.error}</p>
            <button
              className="secondary-button"
              onClick={() => setRevision((v) => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Package size={34} />
            <strong>
              {query || filter !== "all"
                ? "No encontramos resultados"
                : "Acá empieza algo bueno"}
            </strong>
            <p>
              {query || filter !== "all"
                ? "Probá con otra búsqueda o cambiá el filtro."
                : `Tus registros de ${titles[resource].toLowerCase()} aparecerán acá.`}
            </p>
            {writable && !query && filter === "all" && (
              <button
                className="secondary-button"
                onClick={() => setCompose(true)}
              >
                <Plus size={15} />
                {createLabels[resource]}
              </button>
            )}
          </div>
        ) : (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>
                    {resource === "customers"
                      ? "Cliente"
                      : resource === "products"
                        ? "Producto"
                        : resource === "inventory"
                          ? "Producto / motivo"
                          : "Referencia / cliente"}
                  </th>
                  <th>
                    {resource === "customers"
                      ? "Contacto"
                      : resource === "products"
                        ? "Precio"
                        : resource === "inventory"
                          ? "Movimiento"
                          : "Importe"}
                  </th>
                  <th>
                    {resource === "customers"
                      ? "Seguimiento"
                      : resource === "products"
                        ? "Disponibilidad"
                        : resource === "quotes"
                          ? "Estado"
                          : "Fecha"}
                  </th>
                  <th>
                    <span className={styles.srOnly}>Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.identity}>
                        {(resource === "customers" ||
                          resource === "products") && (
                          <span className={styles.avatar}>
                            {row.name?.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <strong>
                            {row.name ??
                              (resource === "inventory"
                                ? row.product_name
                                : `#${row.id.slice(0, 8).toUpperCase()}`)}
                          </strong>
                          <small>
                            {resource === "customers"
                              ? statusLabels[row.status ?? "ACTIVE"]
                              : resource === "products"
                                ? row.sku
                                : resource === "inventory"
                                  ? row.reason
                                  : row.customer_name || "Consumidor final"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {resource === "customers" ? (
                        <div className={styles.cellStack}>
                          <span>{row.email || "Sin email"}</span>
                          <small>{row.phone || "Sin teléfono"}</small>
                        </div>
                      ) : resource === "products" ? (
                        <strong className={styles.amount}>
                          {money(row.price_cents ?? 0, currency)}
                        </strong>
                      ) : resource === "inventory" ? (
                        <span
                          className={`${styles.badge} ${(row.quantity ?? 0) < 0 ? styles.warning : ""}`}
                        >
                          {(row.quantity ?? 0) > 0 ? "+" : ""}
                          {row.quantity} unidades
                        </span>
                      ) : (
                        <strong className={styles.amount}>
                          {money(row.total_cents ?? 0, currency)}
                        </strong>
                      )}
                    </td>
                    <td>
                      {resource === "customers" ? (
                        <span className={styles.followup}>
                          {row.next_contact
                            ? date(row.next_contact)
                            : "Sin programar"}
                        </span>
                      ) : resource === "products" ? (
                        <span
                          className={`${styles.badge} ${(row.stock ?? 0) <= (row.minimum_stock ?? 0) ? styles.warning : ""}`}
                        >
                          {row.stock} un. ·{" "}
                          {(row.stock ?? 0) <= (row.minimum_stock ?? 0)
                            ? "Stock bajo"
                            : "Disponible"}
                        </span>
                      ) : resource === "quotes" ? (
                        <span
                          className={`${styles.badge} ${row.status === "REJECTED" ? styles.warning : ""}`}
                        >
                          {statusLabels[row.status ?? "DRAFT"]}
                        </span>
                      ) : (
                        <span className="text-muted">
                          {date(row.created_at)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {details && (
                          <button
                            className="icon-button"
                            aria-label={`Ver ${row.name ?? row.id}`}
                            title="Ver detalle"
                            onClick={() => setView(row)}
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        {writable && editable && (
                          <>
                            <button
                              className="icon-button"
                              aria-label={`Editar ${row.name}`}
                              title="Editar"
                              onClick={() => {
                                setEditing(row);
                                setCompose(true);
                              }}
                            >
                              <PenLine size={15} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Eliminar ${row.name}`}
                              title="Eliminar"
                              onClick={() => {
                                setError("");
                                setDeleting(row);
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className={styles.pagination}>
          <span>
            {loading
              ? "Buscando registros…"
              : `${data?.total ?? 0} registros encontrados`}
          </span>
          <div>
            <button
              className="icon-button"
              disabled={page === 1 || loading}
              aria-label="Página anterior"
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Página {page}
              {data ? ` de ${Math.max(1, Math.ceil(data.total / 12))}` : ""}
            </span>
            <button
              className="icon-button"
              disabled={loading || !data || page * 12 >= data.total}
              aria-label="Página siguiente"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
      {compose && writable && (
        <Composer
          canReadSuppliers={canReadSuppliers}
          resource={resource}
          editing={editing}
          currency={currency}
          onClose={() => {
            setCompose(false);
            setEditing(undefined);
          }}
          onSaved={saved}
        />
      )}
      {view && details && (
        <RecordDetail
          resource={resource as "customers" | "quotes" | "sales"}
          row={view}
          currency={currency}
          writable={writable}
          onClose={() => setView(null)}
          onChanged={changed}
        />
      )}
      {deleting && (
        <Dialog
          title="Eliminar registro"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p>
            ¿Querés eliminar a <strong>{deleting.name}</strong>? Esta acción no
            se puede deshacer.
          </p>
          {resource === "customers" && (
            <p className={styles.help}>
              También se eliminará su historial de contactos.
            </p>
          )}
          {error && (
            <p className="notice-error" role="alert">
              {error}
            </p>
          )}
          <div className={styles.formFooter}>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={busy} onClick={remove}>
              {busy ? "Eliminando…" : "Eliminar registro"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
