"use client";
import { useEffect, useState } from "react";
import { Invitations } from "./Invitations";
import styles from "../business/BusinessModule.module.css";
import { RolesManager, type CustomRole } from "./RolesManager";
type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  custom_role_id?: string | null;
};
const roles: Record<string, string> = {
  OWNER: "Propietario",
  ADMINISTRATOR: "Administrador",
  MANAGER: "Responsable",
  SALES: "Ventas",
  SUPPORT: "Soporte",
  OPERATIONS: "Operaciones",
  FINANCE: "Finanzas",
  CASHIER: "Caja",
  INVENTORY: "Inventario",
  VIEWER: "Solo lectura",
};
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function TeamView({
  adminOrganizationId,
  currentRole = "OWNER",
  onChanged,
}: {
  adminOrganizationId?: string;
  currentRole?: string;
  onChanged?: () => void;
}) {
  const base = adminOrganizationId
    ? `/api/admin/organizations/${adminOrganizationId}/members`
    : "/api/v1/members";
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);

  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  useEffect(() => {
    if (adminOrganizationId || currentRole !== "OWNER") return;
    let active = true;
    request("/api/v1/roles")
      .then((d) => {
        if (active) setCustomRoles(d.roles);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [adminOrganizationId, currentRole, revision]);
  useEffect(() => {
    let active = true;
    request(base)
      .then((data) => {
        if (active) setMembers(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, revision]);
  async function mutate(id: string, role: string | null) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(
        `${base}/${id}`,
        role ? "PATCH" : "DELETE",
        role
          ? role.startsWith("custom:")
            ? { role: "CUSTOM", customRoleId: role.slice(7) }
            : { role }
          : undefined,
      );
      setRevision((v) => v + 1);
      onChanged?.();
      setMessage(
        "Membresía actualizada. Las sesiones de ese usuario en esta empresa se cerraron.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.module}>
      <div className={styles.heading}>
        <div>
          <h1>Equipo y roles</h1>
          <p>
            Organizá tu equipo y asigná los permisos que necesita cada persona.
            Cada negocio conserva al menos un propietario.
          </p>
        </div>
      </div>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice-success" role="status">
          {message}
        </p>
      )}
      <div className={`${styles.listPanel} ${styles.table}`}>
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow
                key={`${m.id}:${m.role}:${m.custom_role_id}`}
                customRoles={customRoles}
                member={m}
                disabled={
                  busy ||
                  !!adminOrganizationId ||
                  (!adminOrganizationId &&
                    !["OWNER", "ADMINISTRATOR", "ADMIN"].includes(
                      currentRole,
                    )) ||
                  (!adminOrganizationId &&
                    currentRole !== "OWNER" &&
                    m.role === "OWNER")
                }
                allowOwner={!!adminOrganizationId || currentRole === "OWNER"}
                change={mutate}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!adminOrganizationId && currentRole === "OWNER" && (
        <RolesManager
          onChanged={() => {
            setRevision((r) => r + 1);
            onChanged?.();
          }}
        />
      )}
      {!adminOrganizationId && currentRole === "OWNER" && (
        <Invitations roles={customRoles} />
      )}
      {adminOrganizationId && (
        <p>
          Los accesos los administra el propietario desde su negocio. NUBRA solo
          consulta la composición del equipo.
        </p>
      )}
    </section>
  );
}
function MemberRow({
  member,
  disabled,
  allowOwner,
  change,
  customRoles,
}: {
  member: Member;
  disabled: boolean;
  allowOwner: boolean;
  change: (id: string, role: string | null) => void;
  customRoles: CustomRole[];
}) {
  const initialRole = member.custom_role_id
    ? "custom:" + member.custom_role_id
    : member.role;
  const [role, setRole] = useState(initialRole);
  const [remove, setRemove] = useState(false);
  return (
    <tr>
      <td>
        <strong>{member.name}</strong>
        <div>{member.email}</div>
      </td>
      <td>
        <select
          aria-label={`Rol de ${member.name}`}
          value={role}
          disabled={disabled}
          onChange={(e) => setRole(e.target.value)}
        >
          {Object.entries(roles)
            .filter(
              ([key]) =>
                allowOwner || key !== "OWNER" || member.role === "OWNER",
            )
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          {customRoles.map((r) => (
            <option key={r.id} value={"custom:" + r.id}>
              {r.name} · Propio
            </option>
          ))}
          {member.role === "CUSTOM" &&
            !customRoles.some((r) => r.id === member.custom_role_id) && (
              <option value={initialRole}>Rol personalizado</option>
            )}
        </select>
      </td>
      <td>
        <button
          className="secondary-button"
          disabled={disabled || role === initialRole}
          onClick={() => change(member.id, role)}
        >
          Guardar rol
        </button>
        {remove ? (
          <>
            <span>¿Quitar acceso?</span>
            <button
              className="secondary-button"
              disabled={disabled}
              onClick={() => change(member.id, null)}
            >
              Confirmar
            </button>
            <button
              className="secondary-button"
              onClick={() => setRemove(false)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            className="secondary-button"
            disabled={disabled}
            onClick={() => setRemove(true)}
          >
            Quitar
          </button>
        )}
      </td>
    </tr>
  );
}
