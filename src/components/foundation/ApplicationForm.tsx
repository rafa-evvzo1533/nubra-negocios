"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./AccountForms";
import s from "./Foundation.module.css";
type Data = {
  account: { name: string; email: string; email_verified_at: string | null };
  application: {
    status: string;
    business_data: Record<string, unknown>;
    requested_plan: string;
    review_message: string;
  } | null;
  documents: { id: string; slug: string; title: string; version: string }[];
};
const labels: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente de revisión",
  UNDER_REVIEW: "En revisión",
  NEEDS_INFORMATION: "Necesitamos más información",
  APPROVED: "Solicitud aprobada",
  REJECTED: "Solicitud rechazada",
  SUSPENDED: "Acceso suspendido",
  BLOCKED: "Acceso bloqueado",
};
const fields = [
  ["name", "Nombre comercial", true],
  ["legalName", "Razón social"],
  ["taxId", "Identificación fiscal (si corresponde)"],
  ["email", "Email del negocio", true],
  ["phone", "Teléfono"],
  ["whatsapp", "WhatsApp"],
  ["address", "Dirección"],
  ["city", "Ciudad"],
  ["province", "Provincia / estado"],
  ["country", "País", true],
  ["postalCode", "Código postal"],
  ["website", "Sitio web"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["responsibleName", "Nombre del responsable", true],
  ["responsiblePhone", "Teléfono del responsable"],
  ["referral", "¿Cómo conociste NUBRA?"],
] as const;
export function ApplicationForm({ data }: { data: Data }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const app = data.application,
    b = app?.business_data ?? {},
    editable = !app || ["DRAFT", "NEEDS_INFORMATION"].includes(app.status);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const submit =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "submit";
    const business: Record<string, unknown> = {};
    for (const [key] of fields) business[key] = f.get(key);
    for (const key of [
      "sector",
      "businessType",
      "description",
      "notes",
      "currency",
      "timezone",
    ])
      business[key] = f.get(key);
    for (const key of ["employees", "branches"])
      business[key] = Number(f.get(key));
    for (const key of ["physicalStore", "ecommerce"])
      business[key] = f.get(key) === "on";
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/application", "POST", {
        business,
        requestedPlan: f.get("requestedPlan"),
        submit,
        legalVersionIds: data.documents
          .filter((d) => f.get(d.id) === "on")
          .map((d) => d.id),
      });
      setMessage(
        submit
          ? "Solicitud enviada. NUBRA revisará tu negocio."
          : "Borrador guardado.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      setMessage((await api("/api/auth/verify-email", "PUT")).message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.content}>
      <section className={s.card}>
        <span className={s.eyebrow}>Tu solicitud de acceso</span>
        <h1>Hola, {data.account.name}.</h1>
        <div className={s.actions}>
          <span className={s.badge}>
            {!data.account.email_verified_at
              ? "Verificá tu email"
              : labels[app?.status ?? "DRAFT"]}
          </span>
          <button className="secondary-button" onClick={() => router.refresh()}>
            Actualizar estado
          </button>
          <button
            className="secondary-button"
            onClick={async () => {
              await api("/api/auth/logout", "POST", {});
              router.replace("/login");
              router.refresh();
            }}
          >
            Cerrar sesión
          </button>
        </div>
        {app?.review_message && <p>{app.review_message}</p>}
        {app?.status === "APPROVED" && (
          <p>
            <Link className="primary-button" href="/">
              Entrar a mi negocio →
            </Link>
          </p>
        )}
        {!editable && app?.status !== "APPROVED" && (
          <p>
            Tu solicitud está registrada. Podrás actualizar la información si
            NUBRA te lo solicita.
          </p>
        )}
        {!data.account.email_verified_at && (
          <>
            <p>
              Enviamos un enlace a {data.account.email}. Verificá tu dirección
              antes de completar el negocio.
            </p>
            <button className="primary-button" onClick={resend} disabled={busy}>
              Reenviar verificación
            </button>
          </>
        )}
      </section>
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
      {data.account.email_verified_at && editable && (
        <form className={`${s.card} ${s.form}`} onSubmit={submit}>
          <h2>Contanos sobre tu negocio</h2>
          <p>
            Los datos fiscales y de contacto adicionales son opcionales. El plan
            solicitado expresa tu interés comercial; al aprobarte comenzás en
            Free.
          </p>
          <div className={s.grid}>
            {fields.map(([key, label, required]) => (
              <label key={key}>
                {label}
                {required ? " *" : ""}
                <input
                  name={key}
                  required={!!required}
                  type={
                    key === "email"
                      ? "email"
                      : key === "website"
                        ? "url"
                        : "text"
                  }
                  maxLength={key === "email" ? 320 : 240}
                  defaultValue={String(
                    b[key] ??
                      (key === "email"
                        ? data.account.email
                        : key === "responsibleName"
                          ? data.account.name
                          : key === "country"
                            ? "Argentina"
                            : ""),
                  )}
                />
              </label>
            ))}
            <label>
              Rubro *
              <select name="sector" defaultValue={String(b.sector ?? "Retail")}>
                {[
                  "Retail",
                  "Servicios",
                  "Tecnología",
                  "Agencia",
                  "Profesional",
                  "Mayorista",
                  "Distribuidora",
                  "Restaurante",
                  "Ecommerce",
                  "Otro",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo de negocio *
              <select
                name="businessType"
                defaultValue={String(b.businessType ?? "Emprendimiento")}
              >
                {[
                  "Emprendimiento",
                  "Comercio",
                  "Profesional independiente",
                  "PyME",
                  "Empresa",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Empleados aproximados
              <input
                name="employees"
                type="number"
                min={0}
                max={1000000}
                defaultValue={Number(b.employees ?? 0)}
              />
            </label>
            <label>
              Sucursales
              <input
                name="branches"
                type="number"
                min={0}
                max={10000}
                defaultValue={Number(b.branches ?? 1)}
              />
            </label>
            <label>
              Moneda
              <select
                name="currency"
                defaultValue={String(b.currency ?? "ARS")}
              >
                {[
                  "ARS",
                  "USD",
                  "EUR",
                  "UYU",
                  "CLP",
                  "MXN",
                  "COP",
                  "BRL",
                  "PEN",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Zona horaria
              <input
                name="timezone"
                required
                defaultValue={String(
                  b.timezone ?? "America/Argentina/Buenos_Aires",
                )}
              />
            </label>
          </div>
          <div className={s.actions}>
            <label className={s.check}>
              <input
                type="checkbox"
                name="physicalStore"
                defaultChecked={!!b.physicalStore}
              />
              Tiene local físico
            </label>
            <label className={s.check}>
              <input
                type="checkbox"
                name="ecommerce"
                defaultChecked={!!b.ecommerce}
              />
              Tiene ecommerce
            </label>
          </div>
          <label>
            Descripción
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={String(b.description ?? "")}
            />
          </label>
          <label>
            Observaciones
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={String(b.notes ?? "")}
            />
          </label>
          <label>
            Plan de interés
            <select
              name="requestedPlan"
              defaultValue={app?.requested_plan ?? "FREE"}
            >
              {["FREE", "LITE", "BUSINESS", "ENTERPRISE"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {data.documents.map((d) => (
            <label className={s.check} key={d.id}>
              <input type="checkbox" name={d.id} />
              <span>
                Leí y acepto{" "}
                <Link href={`/${d.slug}`} target="_blank">
                  {d.title}
                </Link>
                , versión {d.version}.
              </span>
            </label>
          ))}
          <div className={s.actions}>
            <button
              className="secondary-button"
              name="action"
              value="draft"
              disabled={busy}
            >
              Guardar borrador
            </button>
            <button
              className="primary-button"
              name="action"
              value="submit"
              disabled={busy}
            >
              {busy ? "Guardando…" : "Enviar solicitud a NUBRA"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
