"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "./AccountForms";
import { Dialog } from "../ui/Dialog";
import s from "./Foundation.module.css";
type Request = {
  id: string;
  organization_name: string;
  username: string;
  reason: string;
  scope: string[];
  status: string;
  duration_minutes: number;
  grant_id: string | null;
  expires_at: string | null;
};
const labels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  REVOKED: "Revocado",
  EXPIRED: "Vencido",
};
export function SupportAccess({
  internal = false,
  organizations = [],
}: {
  internal?: boolean;
  organizations?: { id: string; name: string }[];
}) {
  const [items, setItems] = useState<Request[]>([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const base = internal ? "/api/internal/support" : "/api/v1/support-access";
  useEffect(() => {
    let active = true;
    api(base)
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, revision]);
  async function act(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, "POST", body);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(base, {
      organizationId: f.get("organization"),
      reason: f.get("reason"),
      scope: f.getAll("scope"),
      durationMinutes: Number(f.get("duration")),
    });
  }
  return (
    <section className={s.card}>
      <span className={s.eyebrow}>Privacidad y soporte</span>
      <h2>Acceso temporal autorizado</h2>
      <p>
        El soporte solo puede leer los recursos que apruebes, durante el plazo
        indicado. No incluye contactos, notas privadas, importes de ventas, caja
        ni archivos. Podés revocarlo en cualquier momento.
      </p>
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      {internal && (
        <form className={s.form} onSubmit={submit}>
          <div className={s.grid}>
            <label>
              Negocio
              <select name="organization" required>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duración
              <select name="duration">
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="240">4 horas</option>
              </select>
            </label>
          </div>
          <label>
            Motivo del acceso
            <textarea name="reason" required minLength={15} maxLength={1000} />
          </label>
          <div className={s.actions}>
            {[
              ["customers.read", "Clientes (datos básicos)"],
              ["inventory.read", "Inventario"],
              ["sales.read", "Ventas (estado y referencia)"],
            ].map(([key, label]) => (
              <label className={s.check} key={key}>
                <input name="scope" type="checkbox" value={key} />
                {label}
              </label>
            ))}
          </div>
          <button
            className="primary-button"
            disabled={busy || !organizations.length}
          >
            Solicitar autorización al propietario
          </button>
        </form>
      )}
      {!items.length && <p>No hay solicitudes de soporte.</p>}
      {items.map((r) => (
        <article className={s.roleCard} style={{ marginTop: 20 }} key={r.id}>
          <div className={s.actions}>
            <h3>{internal ? r.organization_name : r.username}</h3>
            <span className={s.badge}>{labels[r.status]}</span>
          </div>
          <p>{r.reason}</p>
          <p>
            {r.scope.join(" · ")} · {r.duration_minutes} minutos
            {r.expires_at
              ? " · Hasta " + new Date(r.expires_at).toLocaleString("es-AR")
              : ""}
          </p>
          <div className={s.actions}>
            {!internal && r.status === "PENDING" && (
              <>
                <button
                  disabled={busy}
                  className="primary-button"
                  onClick={() => act(base + "/" + r.id, { action: "APPROVE" })}
                >
                  Aprobar acceso
                </button>
                <button
                  disabled={busy}
                  className="secondary-button"
                  onClick={() => act(base + "/" + r.id, { action: "REJECT" })}
                >
                  Rechazar
                </button>
              </>
            )}
            {!internal && r.status === "APPROVED" && (
              <button
                disabled={busy}
                className="danger-button"
                onClick={() => act(base + "/" + r.id, { action: "REVOKE" })}
              >
                Revocar acceso
              </button>
            )}
            {internal &&
              r.status === "APPROVED" &&
              r.scope.map((scope) => (
                <button
                  className="secondary-button"
                  key={scope}
                  onClick={async () => {
                    setError("");
                    try {
                      setPreview(
                        (
                          await api(
                            base + "/" + r.grant_id + "/" + scope.split(".")[0],
                          )
                        ).items,
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >
                  Consultar {scope.split(".")[0]}
                </button>
              ))}
          </div>
        </article>
      ))}
      {preview && (
        <Dialog
          title="Consulta de soporte auditada"
          onClose={() => setPreview(null)}
          wide
        >
          <div className={s.scroll}>
            {preview.length ? (
              <table className={s.table}>
                <thead>
                  <tr>
                    {Object.keys(preview[0]).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j}>{String(v ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay registros disponibles dentro del alcance autorizado.</p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
