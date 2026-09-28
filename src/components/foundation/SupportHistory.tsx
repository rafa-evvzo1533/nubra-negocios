"use client";
import { useEffect, useState } from "react";
import { api } from "./AccountForms";
import s from "./Foundation.module.css";
type Event = {
  id: string;
  action: string;
  created_at: string;
  username: string | null;
  metadata: { resource?: string; count?: number } | null;
};
const labels: Record<string, string> = {
  SUPPORT_ACCESS_REQUESTED: "Autorización solicitada",
  SUPPORT_ACCESS_APPROVED: "Autorización aprobada",
  SUPPORT_ACCESS_REJECTED: "Autorización rechazada",
  SUPPORT_ACCESS_REVOKED: "Acceso revocado",
  SUPPORT_ACCESS_EXPIRED: "Acceso vencido",
  SUPPORT_ACCESS_STARTED: "Consulta iniciada",
  SUPPORT_ACCESS_DENIED: "Intento denegado",
  SUPPORT_RESOURCE_ACCESSED: "Recurso consultado",
};
export function SupportHistory() {
  const [events, setEvents] = useState<Event[]>([]),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setEvents(await api("/api/v1/support-access/history"));
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el historial",
      );
    }
  }
  useEffect(() => {
    let active = true;
    api("/api/v1/support-access/history")
      .then((data) => {
        if (active) setEvents(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className={s.card}>
      <div className={s.actions}>
        <h2>Historial de soporte</h2>
        <button className="secondary-button" onClick={refresh}>
          Actualizar historial
        </button>
      </div>
      <p>
        Quién accedió, cuándo y a qué recurso. Las consultas autorizadas también
        quedan registradas.
      </p>
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Personal</th>
              <th>Evento</th>
              <th>Recurso</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString("es-AR")}</td>
                <td>{e.username ?? "Propietario"}</td>
                <td>{labels[e.action] ?? e.action}</td>
                <td>{e.metadata?.resource ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!events.length && <p>No hay eventos registrados.</p>}
    </section>
  );
}
