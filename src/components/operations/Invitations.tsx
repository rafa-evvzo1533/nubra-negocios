"use client";
import { notify } from "../ui/Notifications";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../foundation/AccountForms";
import type { CustomRole } from "./RolesManager";
import s from "../foundation/Foundation.module.css";
type Invite = {
  id: string;
  email: string;
  role_name: string | null;
  role: string;
  expires_at: string;
};
export function Invitations({ roles }: { roles: CustomRole[] }) {
  const [items, setItems] = useState<Invite[]>([]),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/v1/invitations", "GET")
      .then((d) => {
        if (active) setItems(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      role = String(f.get("role"));
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/invitations", "POST", {
        email: f.get("email"),
        ...(role.startsWith("custom:")
          ? { role: "CUSTOM", customRoleId: role.slice(7) }
          : { role }),
      });
      form.reset();
      setRevision((r) => r + 1);
      notify("Invitación enviada por email. Vence en 7 días.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/invitations/" + id, "DELETE");
      setRevision((r) => r + 1);
      notify("Invitación revocada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.card} style={{ marginTop: 24 }}>
      <h2>Invitá a tu equipo</h2>
      <p>
        La persona acepta con su propia cuenta. Las invitaciones pendientes
        reservan un lugar del plan durante 7 días.
      </p>
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}

      <form className={s.form} onSubmit={send}>
        <div className={s.grid}>
          <label>
            Email de la persona
            <input name="email" type="email" required maxLength={320} />
          </label>
          <label>
            Rol al ingresar
            <select name="role" defaultValue="VIEWER">
              <option value="VIEWER">Solo lectura</option>
              <option value="SALES">Ventas</option>
              <option value="CASHIER">Caja</option>
              <option value="INVENTORY">Inventario</option>
              <option value="FINANCE">Finanzas</option>
              <option value="ADMINISTRATOR">Administrador</option>
              {roles.map((r) => (
                <option value={"custom:" + r.id} key={r.id}>
                  {r.name} · Propio
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button className="primary-button" disabled={busy}>
            Enviar invitación
          </button>
        </div>
      </form>
      {items.length > 0 && (
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Vence</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td>{new Date(i.expires_at).toLocaleDateString("es-AR")}</td>
                  <td>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => revoke(i.id)}
                    >
                      Revocar invitación
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
