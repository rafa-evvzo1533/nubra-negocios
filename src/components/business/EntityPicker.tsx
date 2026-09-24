"use client";
import { useEffect, useState } from "react";
import { Search, Plus, LoaderCircle } from "lucide-react";
import { api, type Row } from "./client";
import styles from "./BusinessModule.module.css";
export function EntityPicker({
  resource,
  onSelect,
}: {
  resource: "customers" | "products";
  onSelect: (row: Row) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    query: string;
    rows: Row[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<Row[]>(`${resource}?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((rows) => setResult({ query, rows: rows.slice(0, 8) }))
        .catch((e) => {
          if (!controller.signal.aborted)
            setResult({ query, rows: [], error: e.message });
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [resource, query]);
  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Search size={16} />
        <input
          aria-label={
            resource === "products"
              ? "Buscar producto para agregar"
              : "Buscar cliente para seleccionar"
          }
          placeholder={
            resource === "products"
              ? "Buscar por nombre o SKU…"
              : "Buscar por nombre o email…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className={styles.pickerResults}>
        {!result || result.query !== query ? (
          <p>
            <LoaderCircle size={15} className="spinner" /> Buscando…
          </p>
        ) : result.error ? (
          <p role="alert">{result.error}</p>
        ) : result.rows.length ? (
          result.rows.map((row) => (
            <button type="button" key={row.id} onClick={() => onSelect(row)}>
              <span>
                <strong>{row.name}</strong>
                <small>
                  {resource === "products"
                    ? `${row.sku} · ${row.stock} disponibles`
                    : row.email || "Sin email"}
                </small>
              </span>
              <Plus size={15} />
            </button>
          ))
        ) : (
          <p>
            No se encontraron{" "}
            {resource === "products" ? "productos" : "clientes"}.
          </p>
        )}
      </div>
    </div>
  );
}
