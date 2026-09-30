"use client";
import { confirmAction, notify } from "../ui/Notifications";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../foundation/AccountForms";
import { Dialog } from "../ui/Dialog";
import s from "../foundation/Foundation.module.css";
export type CustomRole = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  members: number;
};
const names: Record<string, string> = {
  customers: "Clientes",
  suppliers: "Proveedores",
  accounts: "Cuenta corriente",
  reports: "Reportes (requiere lectura financiera)",
  audit: "Historial de actividad",
  products: "Productos",
  sales: "Ventas",
  inventory: "Inventario",
  quotes: "Presupuestos",
  cash: "Caja",
  members: "Equipo",
  finance: "Resumen financiero (requiere lectura de caja)",
};
export function RolesManager({ onChanged }: { onChanged: () => void }) {
  const [roles, setRoles] = useState<CustomRole[]>([]),
    [permissions, setPermissions] = useState<string[]>([]),
    [editing, setEditing] = useState<CustomRole | null | undefined>(),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api("/api/v1/roles")
      .then((d) => {
        if (active) {
          setRoles(d.roles);
          setPermissions(d.permissions);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  function open(role: CustomRole | null) {
    setError("");
    setEditing(role);
    setSelected(role?.permissions ?? []);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/v1/roles" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          name: f.get("name"),
          description: f.get("description"),
          permissions: selected,
        },
      );
      setEditing(undefined);
      setRevision((r) => r + 1);
      onChanged();
      notify("Rol guardado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const set = new Set(prev);
      if (checked) {
        set.add(key);
        if (key.endsWith(".write")) set.add(key.replace(".write", ".read"));
      } else {
        set.delete(key);
        if (key.endsWith(".read")) set.delete(key.replace(".read", ".write"));
      }
      return [...set];
    });
  }
  return (
    <section className={s.card} style={{ marginTop: 24 }}>
      <div className={s.actions} style={{ justifyContent: "space-between" }}>
        <div>
          <span className={s.eyebrow}>Permisos a medida</span>
          <h2>Roles de tu negocio</h2>
        </div>
        <button className="primary-button" onClick={() => open(null)}>
          <Plus size={16} />
          Crear rol
        </button>
      </div>
      <p>
        Definí qué puede ver y modificar cada persona. Estos roles solo existen
        dentro de tu empresa.
      </p>
      {error && editing === undefined && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {!roles.length ? (
        <div className="empty-state">
          <ShieldCheck size={32} />
          <strong>Armá tu primer rol</strong>
          <p>
            Por ejemplo: «Vendedor de mostrador» con acceso a clientes y ventas,
            o «Depósito» con acceso al stock.
          </p>
        </div>
      ) : (
        <div className={s.grid}>
          {roles.map((role) => (
            <article className={s.roleCard} key={role.id}>
              <ShieldCheck size={22} />
              <h3>{role.name}</h3>
              <p>{role.description || "Sin descripción"}</p>
              <small>
                {role.permissions.length} permisos · {role.members} personas
              </small>
              <div className={s.actions}>
                <button className="secondary-button" onClick={() => open(role)}>
                  <Pencil size={14} />
                  Editar
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !(await confirmAction(`¿Eliminar el rol ${role.name}?`))
                    )
                      return;
                    setBusy(true);
                    try {
                      await api("/api/v1/roles/" + role.id, "DELETE");
                      notify("Rol eliminado correctamente.");
                      setRevision((r) => r + 1);
                      onChanged();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <Dialog
          title={editing ? "Editar rol" : "Crear rol propio"}
          onClose={() => setEditing(undefined)}
          busy={busy}
          wide
        >
          <form className={s.form} onSubmit={save}>
            <div className={s.grid}>
              <label>
                Nombre del rol
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={editing?.name ?? ""}
                  placeholder="Ej. Encargado de depósito"
                />
              </label>
              <label>
                Descripción
                <input
                  name="description"
                  maxLength={300}
                  defaultValue={editing?.description ?? ""}
                />
              </label>
            </div>
            <div className={s.scroll}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Módulo</th>
                    <th>Ver</th>
                    <th>Crear y modificar</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(names).map(([key, label]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      {["read", "write"].map((action) => (
                        <td key={action}>
                          {permissions.includes(`${key}.${action}`) ? (
                            <input
                              aria-label={`${action === "read" ? "Ver" : "Editar"} ${label}`}
                              type="checkbox"
                              checked={selected.includes(`${key}.${action}`)}
                              onChange={(e) =>
                                toggle(`${key}.${action}`, e.target.checked)
                              }
                            />
                          ) : (
                            <span>Solo administradores</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <fieldset>
              <legend>Permisos adicionales</legend>
              {[
                ["data.export", "Exportar datos de los módulos habilitados"],
                ["sales.analytics", "Ver indicadores y totales de ventas"],
              ].map(
                ([key, label]) =>
                  permissions.includes(key) && (
                    <label key={key} className={s.check}>
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={(e) => toggle(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ),
              )}
            </fieldset>
            <p className={s.muted}>
              La gestión de propietarios, roles y suscripciones queda reservada
              a los responsables del negocio.
            </p>
            {error && (
              <p className="notice-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              Guardar rol
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
