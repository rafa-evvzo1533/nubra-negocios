"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Building2,
  ChevronRight,
  Command,
  FileText,
  Wallet,
  CreditCard,
  Building,
  UsersRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import { can, type Resource } from "@/server/permissions";
import type { UserSession } from "@/server/auth";
import type { DashboardData } from "@/server/dashboard";
import { BusinessModule } from "./business/BusinessModule";
import { Overview } from "./dashboard/Overview";
import { SearchPalette } from "./SearchPalette";
import styles from "./Workspace.module.css";
import { FinanceView } from "./operations/FinanceView";
import { TeamView } from "./operations/TeamView";
type Section = Resource | "dashboard" | "finance" | "team";
type Props = {
  session: Pick<
    UserSession,
    | "name"
    | "organizationId"
    | "organizationName"
    | "role"
    | "currency"
    | "permissions"
  >;
  workspaces: { id: string; name: string }[];
  summary: DashboardData;
};
const navigation = [
  { id: "customers", label: "Clientes", icon: Users },
  { id: "sales", label: "Ventas", icon: ShoppingBag },
  { id: "quotes", label: "Presupuestos", icon: FileText },
  { id: "products", label: "Productos", icon: Package },
  { id: "inventory", label: "Inventario", icon: ArrowDownUp },
] as const;
const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMINISTRATOR: "Administrador",
  MANAGER: "Responsable",
  SALES: "Ventas",
  SUPPORT: "Atención al cliente",
  OPERATIONS: "Operaciones",
  FINANCE: "Finanzas",
  CASHIER: "Caja",
  INVENTORY: "Inventario",
  VIEWER: "Solo lectura",
  ADMIN: "Administrador",
  CUSTOM: "Personalizado",
};
export function Workspace({ session, workspaces, summary }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("dashboard");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [entry, setEntry] = useState({
    query: "",
    filter: "all",
    create: false,
    version: 0,
  });
  const available = navigation.filter((r) =>
    can(session.role, r.id, false, session.permissions),
  );
  function navigate(
    resource: Section,
    create = false,
    filter = "all",
    query = "",
  ) {
    setSection(resource);
    setMobile(false);
    setSearch(false);
    setEntry((previous) => ({
      query,
      filter,
      create,
      version: previous.version + 1,
    }));
  }
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector("dialog[open]")) setSearch(true);
      }
      if (e.key === "Escape") setMobile(false);
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  async function action(url: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (url.endsWith("logout")) {
        startTransition(() => {
          router.replace("/login");
          router.refresh();
        });
      } else {
        navigate("dashboard");
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.shell}>
      {mobile && (
        <button
          className={styles.scrim}
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`${styles.sidebar} ${mobile ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>n</span>
          <span>
            nubra<span className={styles.brandDot}>.</span>
            <small>NEGOCIOS</small>
          </span>
          <button
            className={`${styles.mobileClose} icon-button`}
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <label className={styles.workspacePicker}>
          <span className={styles.workspaceIcon}>
            <Building2 size={19} />
          </span>
          <span>
            <small>MI WORKSPACE</small>
            <select
              aria-label="Workspace"
              value={session.organizationId}
              disabled={busy || pending}
              onChange={(e) =>
                action("/api/auth/workspaces", { workspaceId: e.target.value })
              }
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <nav aria-label="Navegación principal">
          <p>PRINCIPAL</p>
          <button
            aria-current={section === "dashboard" ? "page" : undefined}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span>Inicio</span>
            {section === "dashboard" && <span className={styles.activeDot} />}
          </button>
          <p>GESTIÓN DEL NEGOCIO</p>
          {available.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={section === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {section === id && <span className={styles.activeDot} />}
            </button>
          ))}
          {session.permissions?.includes("cash.read") && (
            <button
              aria-current={section === "finance" ? "page" : undefined}
              onClick={() => navigate("finance")}
            >
              <Wallet size={18} />
              <span>Pagos y caja</span>
            </button>
          )}
          {session.permissions?.includes("members.read") && (
            <button
              aria-current={section === "team" ? "page" : undefined}
              onClick={() => navigate("team")}
            >
              <UsersRound size={18} />
              <span>Equipo y roles</span>
            </button>
          )}
          <p>MI NEGOCIO</p>
          <a href="/settings/subscription">
            <CreditCard size={18} />
            Planes y suscripción
          </a>
          <a href="/register-business">
            <Building size={18} />
            Registrar negocio
          </a>
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.productNote}>
            <span className={styles.noteSymbol}>✦</span>
            <strong>Espacio para crecer</strong>
            <p>
              Tu negocio, más simple.
              <br />
              Todos los días.
            </p>
          </div>
          <div className={styles.profile}>
            <span className={styles.avatar}>
              {session.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{session.name}</strong>
              <small>{roleLabels[session.role]}</small>
            </div>
            <button
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              disabled={busy}
              onClick={() => action("/api/auth/logout")}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <button
              className={`${styles.menuButton} icon-button`}
              aria-label="Abrir menú"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>
              {section === "dashboard"
                ? "Inicio"
                : section === "finance"
                  ? "Pagos y caja"
                  : section === "team"
                    ? "Equipo y roles"
                    : navigation.find((n) => n.id === section)?.label}
            </strong>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.searchButton}
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Buscar en Nubra</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <span className={styles.headerAvatar} title={session.name}>
              {session.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main className={styles.content} id="main-content">
          {error && (
            <p role="alert" className="notice-error">
              {error}
            </p>
          )}
          {busy || pending ? (
            <div className={styles.workspaceLoading} role="status">
              <div className="skeleton" style={{ height: 90 }} />
              <div className="skeleton" style={{ height: 220 }} />
              <p>Preparando tu workspace…</p>
            </div>
          ) : section === "dashboard" ? (
            <Overview
              summary={summary}
              currency={session.currency}
              name={session.name}
              canSell={can(session.role, "sales", true, session.permissions)}
              onNavigate={navigate}
            />
          ) : section === "finance" ? (
            <FinanceView
              currency={session.currency}
              writable={session.permissions?.includes("cash.write") ?? false}
            />
          ) : section === "team" ? (
            <TeamView currentRole={session.role} />
          ) : (
            <BusinessModule
              key={`${session.organizationId}:${section}:${entry.version}`}
              resource={section}
              writable={can(session.role, section, true, session.permissions)}
              exportable={[
                "OWNER",
                "ADMINISTRATOR",
                "ADMIN",
                "MANAGER",
                "FINANCE",
              ].includes(session.role)}
              currency={session.currency}
              onChanged={() => router.refresh()}
              initialSearch={entry.query}
              initialFilter={entry.filter}
              initialOpen={entry.create}
            />
          )}
          <footer className={styles.footer}>
            <span>Nubra Negocios</span>
            <span>Un espacio para hacer crecer tu negocio.</span>
          </footer>
        </main>
      </div>
      {search && (
        <SearchPalette
          resources={available.map((r) => ({ id: r.id, label: r.label }))}
          onClose={() => setSearch(false)}
          onSelect={(resource, query) =>
            navigate(resource, false, "all", query)
          }
        />
      )}
    </div>
  );
}
