"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import s from "./Foundation.module.css";
export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "No se pudo completar la operación");
  return data;
}
export function RegisterForm() {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/register", "POST", Object.fromEntries(f));
      setMessage(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${s.card} ${s.narrow}`}>
      <span className={s.eyebrow}>Paso 1 · Tu cuenta</span>
      <h1>Empecemos por vos.</h1>
      <p>
        Creá tu cuenta, verificá tu email y presentá tu negocio para revisión.
      </p>
      {message ? (
        <>
          <p role="status" className="notice-success">
            {message}
          </p>
          <Link href="/login">Continuar al ingreso</Link>
        </>
      ) : (
        <form className={s.form} onSubmit={submit}>
          <label>
            Nombre y apellido
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
            />
          </label>
          <label>
            Contraseña · al menos 12 caracteres
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              required
            />
          </label>
          <p>
            Al registrarte se tratarán tus datos para gestionar el acceso según
            la <Link href="/privacy">política de privacidad</Link>. La
            aceptación de los documentos se registra al enviar tu solicitud.
          </p>
          <button className="primary-button" disabled={busy}>
            {busy ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>
      )}
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function VerifyForm() {
  const token = useRef("");
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    token.current =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function verify() {
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/verify-email", "POST", {
        token: token.current,
      });
      setMessage(r.message);
      token.current = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${s.card} ${s.narrow}`}>
      <span className={s.eyebrow}>Paso 2 · Verificación</span>
      <h1>Confirmá tu email</h1>
      <p>
        Confirmá que esta dirección te pertenece para continuar con la solicitud
        de tu negocio.
      </p>
      {message ? (
        <p role="status" className="notice-success">
          {message}
        </p>
      ) : (
        <button className="primary-button" onClick={verify} disabled={busy}>
          {busy ? "Verificando…" : "Verificar email"}
        </button>
      )}
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      <p>
        <Link href="/login">Iniciar sesión</Link>
      </p>
    </section>
  );
}
