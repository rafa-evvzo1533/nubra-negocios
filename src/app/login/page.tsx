"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn } from "lucide-react";
import styles from "./login.module.css";
import { Brand } from "@/components/ui/Brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) setError(body.error ?? "No se pudo iniciar sesión.");
      else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("No se pudo conectar. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href="/" aria-label="Nubra Negocios · Inicio">
          <Brand size={100} />
        </Link>
        <p className={styles.kicker}>NUBRA NEGOCIOS</p>
        <h1>Ingresá a tu workspace</h1>
        <p className={styles.description}>
          Ingresá para gestionar tu negocio o consultar tu solicitud.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Contraseña
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button disabled={loading}>
            {loading ? (
              "Ingresando..."
            ) : (
              <>
                <LogIn size={16} /> Ingresar
              </>
            )}
          </button>
        </form>
        <Link href="/forgot-password">Olvidé mi contraseña</Link>
        <div className={styles.notice}>
          <LockKeyhole size={15} /> ¿Todavía no tenés cuenta?{" "}
          <Link href="/register">Solicitá acceso</Link>.
        </div>
      </div>
    </main>
  );
}
