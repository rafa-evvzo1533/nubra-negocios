"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/components/foundation/AccountForms";
import s from "@/components/foundation/Foundation.module.css";
export default function Page() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const token = new URLSearchParams(location.hash.slice(1)).get("token");
      const result = await api("/api/auth/accept-invitation", "POST", {
        token,
      });
      setMessage(result.message);
      history.replaceState(null, "", "/invite");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.page}>
      <section className={`${s.card} ${s.narrow}`}>
        <Link className={s.brand} href="/">
          nubra.
        </Link>
        <h1>Sumate al equipo</h1>
        <p>
          Iniciá sesión con el email que recibió la invitación. Si todavía no
          tenés cuenta, creala y verificá el correo; después volvé a abrir el
          enlace de la invitación.
        </p>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {message ? (
          <p role="status" className="notice-success">
            {message}
          </p>
        ) : (
          <button className="primary-button" disabled={busy} onClick={accept}>
            {busy ? "Validando…" : "Aceptar invitación"}
          </button>
        )}
        <div className={s.actions} style={{ marginTop: 24 }}>
          <Link href="/login">Iniciar sesión</Link>
          <Link href="/register">Crear cuenta</Link>
        </div>
      </section>
    </main>
  );
}
