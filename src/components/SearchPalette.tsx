"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { Resource } from "@/server/permissions";
import { Dialog } from "./ui/Dialog";
import { api, type Row } from "./business/client";
import styles from "./Workspace.module.css";
export function SearchPalette({
  resources,
  onClose,
  onSelect,
}: {
  resources: { id: Resource; label: string }[];
  onClose: () => void;
  onSelect: (resource: Resource, query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{
    query: string;
    results: { resource: Resource; label: string; rows: Row[] }[];
    error?: string;
  } | null>(null);
  const resourceKey = JSON.stringify(resources);
  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const available = JSON.parse(resourceKey) as {
        id: Resource;
        label: string;
      }[];
      Promise.all(
        available.map(async (r) => ({
          resource: r.id,
          label: r.label,
          rows: (
            await api<Row[]>(`${r.id}?q=${encodeURIComponent(query)}`, {
              signal: controller.signal,
            })
          ).slice(0, 3),
        })),
      )
        .then((results) => setState({ query, results }))
        .catch((e) => {
          if (!controller.signal.aborted)
            setState({ query, results: [], error: e.message });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, resourceKey]);
  return (
    <Dialog title="Buscar en tu negocio" onClose={onClose}>
      <div className={styles.paletteInput}>
        <Search size={19} />
        <input
          aria-label="Búsqueda global"
          placeholder="Cliente, producto, venta, presupuesto…"
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {!query.trim() ? (
        <div className={styles.paletteResults}>
          <p>IR A UN MÓDULO</p>
          {resources.map((r) => (
            <button key={r.id} onClick={() => onSelect(r.id, "")}>
              <span>{r.label}</span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      ) : !state || state.query !== query ? (
        <p className={styles.paletteHint}>Buscando en tu workspace…</p>
      ) : state.error ? (
        <p className="notice-error" role="alert">
          {state.error}
        </p>
      ) : state.results.every((g) => !g.rows.length) ? (
        <p className={styles.paletteHint}>
          No encontramos resultados para “{query}”.
        </p>
      ) : (
        <div className={styles.paletteResults}>
          {state.results
            .filter((g) => g.rows.length)
            .map((g) => (
              <div key={g.resource}>
                <p>{g.label.toUpperCase()}</p>
                {g.rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => onSelect(g.resource, query)}
                  >
                    <span>
                      {row.name ??
                        row.product_name ??
                        `#${row.id.slice(0, 8).toUpperCase()}`}
                      <small>
                        {row.email ??
                          row.sku ??
                          row.customer_name ??
                          row.reason}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </Dialog>
  );
}
