"use client";
import { notify } from "../ui/Notifications";
import { displayLabel } from "@/domain/display";
import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Plus,
  Search,
  LogOut,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { TeamView } from "../operations/TeamView";
import common from "../business/BusinessModule.module.css";
import styles from "./AdminView.module.css";
import { Brand } from "../ui/Brand";
type Organization = {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  active: boolean;
  memberCount: number;
};
type Log = { id: string; action: string; created_at: string };
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la operación");
  return data;
}
export function AdminView({ onBack }: { onBack: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const [tab, setTab] = useState("data");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/organizations", { cache: "no-store" })
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          if (active) {
            setOrganizations(d.organizations);
            setAuthenticated(true);
          }
        }
      })
      .catch(() => {
        if (active) setError("No se pudo conectar con el servidor");
      });
    return () => {
      active = false;
    };
  }, []);
  async function reload() {
    const data = await request("/api/admin/organizations");
    setOrganizations(data.organizations);
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/login", "POST", {
        username: f.get("username"),
        password: f.get("password"),
      });
      form.reset();
      await reload();
      setAuthenticated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await request("/api/admin/logout", "POST", {});
      setAuthenticated(false);
      setOrganizations([]);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  const current = organizations.find((o) => o.id === selected);
  const filtered = organizations.filter((o) =>
    `${o.name} ${o.taxId ?? ""} ${o.email ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <Brand />
          <p className={styles.eyebrow}>NUBRA · ADMINISTRACIÓN</p>
          <h1>Gestión de empresas</h1>
          <p className={styles.subtitle}>
            Cuentas, accesos y datos de cada negocio.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="primary-button" href="/internal">
            Solicitudes y suscripciones
          </a>
          <button className="secondary-button" onClick={onBack}>
            Volver al workspace
          </button>
          {authenticated && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={logout}
            >
              <LogOut size={16} /> Cerrar sesión admin
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}

      {!authenticated ? (
        <section className={styles.section}>
          <form className={styles.authCard} onSubmit={login}>
            <ShieldCheck size={30} />
            <h2>Acceso interno de Nubra</h2>
            <label>
              Usuario
              <input name="username" required autoComplete="username" />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </section>
      ) : current ? (
        <>
          <button
            className="secondary-button"
            onClick={() => {
              setSelected(null);
                      }}
          >
            <ArrowLeft size={16} /> Todas las empresas
          </button>
          <div className={common.heading} style={{ marginTop: 25 }}>
            <h2>{current.name}</h2>
            <span className={common.badge}>
              {current.active ? "Activa" : "Suspendida"} · {current.memberCount}{" "}
              miembros
            </span>
          </div>
          <nav
            style={{ display: "flex", gap: 10, marginBottom: 24 }}
            aria-label="Gestión de empresa"
          >
            <button
              className={tab === "data" ? "primary-button" : "secondary-button"}
              onClick={() => setTab("data")}
            >
              Datos de empresa
            </button>
            <button
              className={tab === "team" ? "primary-button" : "secondary-button"}
              onClick={() => setTab("team")}
            >
              Usuarios y roles
            </button>
            <button
              className={
                tab === "audit" ? "primary-button" : "secondary-button"
              }
              onClick={() => setTab("audit")}
            >
              Auditoría
            </button>
          </nav>
          <section className={styles.section}>
            {tab === "data" ? (
              <OrganizationForm
                key={current.id + current.name + current.active}
                organization={current}
                onSaved={async () => {
                  await reload();
                  notify("Datos de la empresa actualizados.");
                }}
              />
            ) : tab === "team" ? (
              <TeamView
                key={current.id}
                adminOrganizationId={current.id}
                onChanged={() => void reload()}
              />
            ) : (
              <AuditView organizationId={current.id} />
            )}
          </section>
        </>
      ) : (
        <section className={common.listPanel}>
          <div className={common.toolbar}>
            <label className={common.search}>
              <Search size={17} />
              <input
                aria-label="Buscar empresas"
                placeholder="Nombre, CUIT o email…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <button className="primary-button" onClick={() => setCreate(true)}>
              <Plus size={17} /> Crear empresa
            </button>
          </div>
          <div className={common.table}>
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 12, page * 12).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.name}</strong>
                      <div>{o.taxId || "Sin CUIT cargado"}</div>
                    </td>
                    <td>{o.email || "Sin email"}</td>
                    <td>
                      <span
                        className={`${common.badge} ${!o.active ? common.warning : ""}`}
                      >
                        {o.active ? "Activa" : "Suspendida"}
                      </span>
                    </td>
                    <td>{o.memberCount}</td>
                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setSelected(o.id);
                          setTab("data");
                                              }}
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Building2 size={30} />
              <strong>No hay empresas para mostrar</strong>
            </div>
          )}
          <footer className={common.pagination}>
            <span>{filtered.length} empresas</span>
            <div>
              <button
                className="secondary-button"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Anterior
              </button>
              <span>Página {page}</span>
              <button
                className="secondary-button"
                disabled={page * 12 >= filtered.length}
                onClick={() => setPage((v) => v + 1)}
              >
                Siguiente
              </button>
            </div>
          </footer>
        </section>
      )}
      {create && (
        <Dialog
          title="Crear empresa y propietario"
          onClose={() => setCreate(false)}
          wide
        >
          <OrganizationForm
            onSaved={async (id) => {
              setCreate(false);
              await reload();
              setSelected(id ?? null);
              setTab("data");
              notify(
                "Empresa creada. Entregá las credenciales al propietario por un canal autorizado.",
              );
            }}
          />
        </Dialog>
      )}
    </main>
  );
}
function OrganizationForm({
  organization,
  onSaved,
}: {
  organization?: Organization;
  onSaved: (id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (name: string) => String(f.get(name) ?? "");
    setBusy(true);
    setError("");
    try {
      const body = {
        name: val("name"),
        taxId: val("taxId") || undefined,
        email: val("email") || undefined,
        timezone: val("timezone"),
        currency: val("currency"),
        ...(organization
          ? { active: f.get("active") === "on" }
          : {
              ownerName: val("ownerName"),
              ownerEmail: val("ownerEmail"),
              ownerPassword: val("ownerPassword"),
            }),
      };
      const result = await request(
        `/api/admin/organizations${organization ? `/${organization.id}` : ""}`,
        organization ? "PUT" : "POST",
        body,
      );
      await onSaved(result.organization?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={common.form} onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>
          Nombre del negocio
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={organization?.name}
          />
        </label>
        <div className={common.formGrid}>
          <label>
            CUIT o identificador fiscal
            <input
              name="taxId"
              maxLength={32}
              defaultValue={organization?.taxId ?? ""}
            />
          </label>
          <label>
            Email de contacto
            <input
              name="email"
              type="email"
              maxLength={320}
              defaultValue={organization?.email ?? ""}
            />
          </label>
        </div>
        <div className={common.formGrid}>
          <label>
            Zona horaria
            <input
              name="timezone"
              required
              defaultValue={
                organization?.timezone ?? "America/Argentina/Buenos_Aires"
              }
            />
          </label>
          <label>
            Moneda
            <input
              name="currency"
              pattern="[A-Za-z]{3}"
              required
              maxLength={3}
              defaultValue={organization?.currency ?? "ARS"}
            />
          </label>
        </div>
        {organization ? (
          <>
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={organization.active}
                style={{ width: "auto" }}
              />{" "}
              Empresa activa
            </label>
            <p className={common.help}>
              Suspender la empresa cierra sus sesiones e impide nuevos accesos
              al workspace. No elimina datos.
            </p>
          </>
        ) : (
          <>
            <h3>Propietario inicial</h3>
            <label>
              Nombre del propietario
              <input name="ownerName" required minLength={2} maxLength={120} />
            </label>
            <label>
              Email de acceso
              <input name="ownerEmail" type="email" required maxLength={320} />
            </label>
            <label>
              Contraseña inicial
              <input
                name="ownerPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
              />
            </label>
          </>
        )}
      </fieldset>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={busy}>
        {busy
          ? "Guardando…"
          : organization
            ? "Guardar empresa"
            : "Crear empresa"}
      </button>
    </form>
  );
}
function AuditView({ organizationId }: { organizationId: string }) {
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request(`/api/admin/organizations/${organizationId}/audit`)
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [organizationId]);
  return (
    <div>
      {error && <p className="notice-error">{error}</p>}
      <h2>Últimas 100 acciones</h2>
      {logs?.map((log) => (
        <p
          key={log.id}
          style={{ padding: 12, borderBottom: "1px solid var(--line)" }}
        >
          {displayLabel(log.action)} ·{" "}
          {new Date(log.created_at).toLocaleString("es-AR")}
        </p>
      ))}
      {logs?.length === 0 && <p>Sin actividad registrada.</p>}
    </div>
  );
}
