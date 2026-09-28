"use client";
import {confirmAction} from "../ui/Notifications";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./AccountForms";
import { SupportHistory } from "./SupportHistory";
import { SupportAccess } from "./SupportAccess";
import { Brand } from "../ui/Brand";
import s from "./Foundation.module.css";
type Session = {
  id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  current: boolean;
};
export function SecurityView({ owner }: { owner: boolean }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api("/api/auth/sessions")
      .then((d) => {
        if (active) setSessions(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function revoke(target: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/sessions", "DELETE", { target });
      setRevision((v) => v + 1);
      if (target === "all" || sessions.find((s) => s.id === target)?.current) {
        router.replace("/login");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.page}>
      <div className={s.content}>
        <nav className={s.nav}>
          <Brand />
          <Link href="/">← Volver al negocio</Link>
        </nav>
        <div className={s.pricingIntro}>
          <span className={s.eyebrow}>Tu cuenta, bajo control</span>
          <h1>Seguridad y privacidad</h1>
          <p>Administrá tus sesiones y las autorizaciones de soporte.</p>
        </div>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        <section className={s.card}>
          <h2>Sesiones de tu cuenta</h2>
          <p>
            Cerrá accesos que ya no uses. Los tokens no se muestran ni se
            guardan en el navegador fuera de cookies protegidas.
          </p>
          <div className={s.actions}>
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() => revoke("others")}
            >
              Cerrar otras sesiones
            </button>
            <button
              disabled={busy}
              className="danger-button"
              onClick={async () => {
                if (await confirmAction("¿Cerrar todas las sesiones, incluida esta?"))
                  void revoke("all");
              }}
            >
              Cerrar todas
            </button>
          </div>
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Inicio</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.device_label}
                      {v.current ? " · Actual" : ""}
                    </td>
                    <td>{new Date(v.created_at).toLocaleString("es-AR")}</td>
                    <td>
                      {v.revoked_at
                        ? "Revocada"
                        : new Date(v.expires_at) < new Date()
                          ? "Vencida"
                          : "Activa"}
                    </td>
                    <td>
                      {!v.revoked_at && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => revoke(v.id)}
                        >
                          Cerrar sesión
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {owner && (
          <>
            <SupportAccess />
            <SupportHistory />
          </>
        )}
      </div>
    </main>
  );
}
