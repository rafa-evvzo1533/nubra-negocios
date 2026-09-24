"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "@/app/login/login.module.css";
export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reset) {
      const t = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
      history.replaceState(null, "", location.pathname);
      queueMicrotask(() => setToken(t));
    }
  }, [reset]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (reset && f.get("password") !== f.get("confirmation"))
        throw new Error("Las contraseñas no coinciden");
      const response = await fetch(
        `/api/auth/${reset ? "reset-password" : "forgot-password"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            reset
              ? { token, password: f.get("password") }
              : { email: f.get("email") },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>N</div>
        <h1>{reset ? "Elegí una nueva contraseña" : "Recuperá tu acceso"}</h1>
        <p className={styles.description}>
          {reset
            ? "La contraseña debe tener al menos 12 caracteres."
            : "Enviaremos un enlace al email de tu cuenta."}
        </p>
        {!done && (
          <form onSubmit={submit}>
            {reset ? (
              <>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={200}
                  />
                </label>
                <label>
                  Repetir contraseña
                  <input
                    type="password"
                    name="confirmation"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={200}
                  />
                </label>
              </>
            ) : (
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                />
              </label>
            )}
            <button disabled={busy || (reset && !token)}>
              {busy
                ? "Procesando…"
                : reset
                  ? "Cambiar contraseña"
                  : "Enviar enlace"}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice-success">
            {message}
          </p>
        )}
        <Link href="/login">Volver al inicio de sesión</Link>
      </div>
    </main>
  );
}
