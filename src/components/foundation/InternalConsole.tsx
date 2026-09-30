"use client";
import { notify } from "../ui/Notifications";
import { confirmAction } from "../ui/Notifications";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "./AccountForms";
import s from "./Foundation.module.css";
import { SupportAccess } from "./SupportAccess";
import { PriceEditor } from "./PriceEditor";
import { Brand } from "../ui/Brand";
import { businessFields, displayLabel, displayValue } from "@/domain/display";
type Application = {
  id: string;
  status: string;
  name: string;
  email: string;
  business_data: Record<string, unknown>;
  requested_plan: string;
  review_message: string;
};
type Org = {
  id: string;
  name: string;
  status: string;
  plan: string;
  source: string;
  users: number;
  requested_plan: string | null;
};
type Plan = {
  price_cents: number | null;
  checkout_enabled: boolean;
  annual_price_cents?: number | null;
  annual_checkout_enabled?: boolean;
  code: string;
  name: string;
  entitlements: {
    key: string;
    name: string;
    enabled: boolean;
    available: boolean;
    limit: number | null;
  }[];
};
type Props = {
  actor: { role: string; username: string } | null;
  applications: Application[];
  organizations: Org[];
  plans: Plan[];
};
export function InternalConsole({
  actor,
  applications,
  organizations,
  plans,
}: Props) {
  const router = useRouter(),
    [tab, setTab] = useState("applications"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const canReview =
      !!actor &&
      ["SUPER_ADMIN", "OPERATIONS_ADMIN", "REVIEWER"].includes(actor.role),
    canBill =
      !!actor &&
      ["SUPER_ADMIN", "BILLING_ADMIN", "SALES_ADMIN"].includes(actor.role),
    canOperate =
      !!actor && ["SUPER_ADMIN", "OPERATIONS_ADMIN"].includes(actor.role);
  async function run(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      notify("Cambio guardado y registrado en auditoría.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  }
  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run(
      "/api/admin/login",
      Object.fromEntries(new FormData(e.currentTarget)),
    );
  }
  return (
    <main className={s.page}>
      <header className={s.nav}>
        <div>
          <Brand />
          <span className={s.eyebrow}>NUBRA · Acceso interno</span>
          <h1>Administración de la plataforma</h1>
          {actor && (
            <p>
              {actor.username} · {displayLabel(actor.role)}
            </p>
          )}
        </div>
        <div className={s.actions}>
          <Link href="/">Ir a la web</Link>
          {actor && (
            <button
              className="secondary-button"
              onClick={() => run("/api/admin/logout", {})}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </header>
      <div className={s.content}>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}

        {!actor ? (
          <form className={`${s.card} ${s.form} ${s.narrow}`} onSubmit={login}>
            <h2>Ingresar como personal NUBRA</h2>
            <label>
              Usuario
              <input name="username" required autoComplete="username" />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              Ingresar
            </button>
          </form>
        ) : (
          <>
            <nav
              className={s.actions}
              aria-label="Administración"
              style={{ marginBottom: 24 }}
            >
              {[
                ["applications", "Solicitudes"],
                ["organizations", "Empresas y suscripciones"],
                ["plans", "Planes y límites"],
                ...(["SUPER_ADMIN", "SUPPORT_ADMIN", "SECURITY_ADMIN"].includes(
                  actor.role,
                )
                  ? [["support", "Soporte autorizado"]]
                  : []),
              ].map(([key, label]) => (
                <button
                  className={
                    tab === key ? "primary-button" : "secondary-button"
                  }
                  key={key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
              {actor.role === "SUPER_ADMIN" && (
                <Link href="/admin">Gestión de accesos</Link>
              )}
            </nav>
            {tab === "support" && (
              <SupportAccess internal organizations={organizations} />
            )}
            {tab === "applications" && (
              <>
                <p className={s.muted}>
                  Últimas 200 solicitudes. Aprobar crea el workspace con Free.
                  Los beneficios comerciales se otorgan desde suscripciones.
                </p>
                {!applications.length && (
                  <section className={s.card}>
                    No hay solicitudes todavía.
                  </section>
                )}
                {applications.map((a) => (
                  <article key={a.id} className={s.card}>
                    <h2>{String(a.business_data.name ?? a.name)}</h2>
                    <span className={s.badge}>{displayLabel(a.status)}</span>
                    <p>
                      {a.name} · {a.email} · Interés:{" "}
                      {displayLabel(a.requested_plan)}
                    </p>
                    <details>
                      <summary>Revisar datos del negocio</summary>
                      <dl className={s.businessDetails}>
                        {Object.entries(a.business_data).map(([key, value]) => (
                          <div key={key}>
                            <dt>{businessFields[key] ?? displayLabel(key)}</dt>
                            <dd>{displayValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                    {a.review_message && <p>{a.review_message}</p>}
                    {canReview &&
                      ["PENDING", "UNDER_REVIEW"].includes(a.status) && (
                        <form
                          className={s.form}
                          style={{ marginTop: 24 }}
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            const action = (
                              e.nativeEvent as SubmitEvent
                            ).submitter?.getAttribute("value");
                            if (
                              action === "reject" &&
                              !(await confirmAction(
                                "¿Rechazar esta solicitud? La decisión quedará auditada.",
                              ))
                            )
                              return;
                            void run(
                              `/api/internal/admin/applications/${a.id}`,
                              { action, message: form.get("message") },
                            );
                          }}
                        >
                          <label>
                            Mensaje para el solicitante (obligatorio salvo
                            aprobación)
                            <textarea name="message" maxLength={1000} />
                          </label>
                          <div className={s.actions}>
                            {[
                              ["approve", "Aprobar empresa"],
                              ["review", "Tomar en revisión"],
                              ["information", "Pedir información"],
                              ["reject", "Rechazar"],
                            ].map(([value, label]) => (
                              <button
                                className={
                                  value === "approve"
                                    ? "primary-button"
                                    : "secondary-button"
                                }
                                value={value}
                                disabled={busy}
                                key={value}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </form>
                      )}
                  </article>
                ))}
              </>
            )}
            {tab === "organizations" && (
              <>
                {!organizations.length && <p>No hay empresas aprobadas.</p>}
                {organizations.map((o) => (
                  <article className={s.card} key={o.id}>
                    <h2>{o.name}</h2>
                    <span className={s.badge}>{displayLabel(o.status)}</span>
                    <p>
                      {displayLabel(o.plan)} · {displayLabel(o.source)} ·{" "}
                      {o.users} usuarios
                      {o.requested_plan
                        ? ` · Cambio solicitado: ${o.requested_plan}`
                        : ""}
                    </p>
                    {canBill && (
                      <form
                        className={s.form}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(
                            `/api/internal/admin/organizations/${o.id}`,
                            {
                              action: "plan",
                              subscription: {
                                plan: f.get("plan"),
                                source: f.get("source"),
                                reason: f.get("reason"),
                              },
                            },
                          );
                        }}
                      >
                        <div className={s.grid}>
                          <label>
                            Plan
                            <select name="plan" defaultValue={o.plan}>
                              {plans.map((p) => (
                                <option key={p.code}>{p.code}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Origen
                            <select name="source" defaultValue="MANUAL_GRANT">
                              {[
                                "MANUAL_GRANT",
                                "NUBRA_BASIC_BUNDLE",
                                "NUBRA_ENTERPRISE_BUNDLE",
                                "DIRECT_PURCHASE",
                                "PROMOTION",
                                "MIGRATION",
                              ].map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label>
                          Motivo / referencia comercial
                          <input
                            name="reason"
                            required
                            minLength={3}
                            maxLength={1000}
                          />
                        </label>
                        <button className="primary-button" disabled={busy}>
                          Guardar suscripción
                        </button>
                      </form>
                    )}
                    {canOperate && (
                      <form
                        className={s.form}
                        style={{ marginTop: 24 }}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          if (
                            !(await confirmAction(
                              "¿Cambiar el estado de acceso de esta empresa?",
                            ))
                          )
                            return;
                          void run(
                            `/api/internal/admin/organizations/${o.id}`,
                            {
                              action: "status",
                              status: f.get("status"),
                              reason: f.get("reason"),
                            },
                          );
                        }}
                      >
                        <div className={s.grid}>
                          <label>
                            Acceso
                            <select name="status" defaultValue={o.status}>
                              <option value="APPROVED">Activo</option>
                              <option value="SUSPENDED">Suspendido</option>
                              <option value="BLOCKED">Bloqueado</option>
                            </select>
                          </label>
                          <label>
                            Motivo
                            <input
                              name="reason"
                              required
                              minLength={3}
                              maxLength={1000}
                            />
                          </label>
                        </div>
                        <button className="secondary-button" disabled={busy}>
                          Actualizar acceso
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </>
            )}
            {tab === "plans" && (
              <>
                <p>
                  Los cambios aplican a todas las empresas del plan. Las
                  funciones pendientes de desarrollo permanecen inhabilitadas.
                </p>
                {plans.map((p) => (
                  <section className={s.card} key={p.code}>
                    <h2>{p.name}</h2>
                    {canBill && p.code !== "FREE" && (
                      <>
                        <PriceEditor plan={p} />
                        <PriceEditor plan={p} period="YEARLY" />
                      </>
                    )}
                    {p.entitlements.map((f) => (
                      <form
                        className={s.form}
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "20px 0",
                        }}
                        key={f.key}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          void run(
                            "/api/internal/admin/plans",
                            {
                              plan: p.code,
                              feature: f.key,
                              enabled: fd.get("enabled") === "on",
                              limit:
                                f.limit === null
                                  ? null
                                  : Number(fd.get("limit")),
                              reason: fd.get("reason"),
                            },
                            "PATCH",
                          );
                        }}
                      >
                        <strong>{f.name}</strong>
                        <div className={s.grid}>
                          <label className={s.check}>
                            <input
                              name="enabled"
                              type="checkbox"
                              defaultChecked={f.enabled}
                              disabled={!canBill}
                            />
                            Incluida en el plan
                            {!f.available ? " · Próximamente" : ""}
                          </label>
                          {f.limit !== null && (
                            <label>
                              Límite
                              <input
                                name="limit"
                                type="number"
                                min={0}
                                max={10000000}
                                defaultValue={f.limit}
                                disabled={!canBill}
                              />
                            </label>
                          )}
                        </div>
                        {canBill && (
                          <div className={s.actions}>
                            <label>
                              Motivo
                              <input
                                name="reason"
                                minLength={3}
                                maxLength={1000}
                                required
                              />
                            </label>
                            <button
                              className="secondary-button"
                              disabled={busy}
                            >
                              Guardar capacidad
                            </button>
                          </div>
                        )}
                      </form>
                    ))}
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
