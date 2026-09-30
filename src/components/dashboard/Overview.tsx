"use client";
import {
  ArrowDownUp,
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  Clock,
  Package,
  Plus,
  Users,
} from "lucide-react";
import type { DashboardData } from "@/server/dashboard";
import type { Resource } from "@/server/permissions";
import styles from "./Overview.module.css";
const actionLabels: Record<string, string> = {
  created: "creado",
  updated: "actualizado",
  deleted: "eliminado",
  activity_added: "contacto registrado",
  sent: "marcado como enviado",
  accepted: "aceptado",
  rejected: "rechazado",
  converted: "convertido en venta",
};
const entityLabels: Record<string, string> = {
  customers: "Cliente",
  products: "Producto",
  sales: "Venta",
  inventory: "Movimiento",
  quotes: "Presupuesto",
};
export function Overview({
  summary,
  currency,
  name,
  onNavigate,
  canSell,
}: {
  summary: DashboardData;
  currency: string;
  name: string;
  onNavigate: (resource: Resource, create?: boolean, filter?: string) => void;
  canSell: boolean;
}) {
  const money = (value: string | number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(
      Number(value) / 100,
    );
  const metrics = [
    {
      label: "Ventas de hoy",
      value: summary.today === null ? null : money(summary.today),
      icon: CircleDollarSign,
      tone: "green",
      hint: "Actividad del día",
    },
    {
      label: "Ventas del mes",
      value: summary.month === null ? null : money(summary.month),
      icon: ChartNoAxesCombined,
      tone: "blue",
      hint: "Mes en curso",
    },
    {
      label: "Clientes",
      value: summary.customers,
      icon: Users,
      tone: "amber",
      hint: "Relaciones que crecen",
    },
    {
      label: "Productos",
      value: summary.products,
      icon: Package,
      tone: "violet",
      hint: "Tu catálogo de negocio",
    },
  ];
  const max = Math.max(...summary.trend.map((d) => Number(d.total)), 1);
  const total = summary.trend.reduce((sum, d) => sum + Number(d.total), 0);
  return (
    <div className={styles.overview}>
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>
            <span /> TU NEGOCIO, EN MOVIMIENTO
          </div>
          <h1>
            Todo listo para avanzar, {name.split(" ")[0]}
            <span>.</span>
          </h1>
          <p>Una mirada a lo que está pasando en tu negocio.</p>
        </div>
        {canSell && (
          <button
            className="primary-button"
            onClick={() => onNavigate("sales", true)}
          >
            <Plus size={17} /> Nueva venta
          </button>
        )}
      </div>
      <div className={styles.metrics}>
        {metrics
          .filter((m) => m.value !== null)
          .map(({ label, value, icon: Icon, tone, hint }, i) => (
            <article
              className={styles.metric}
              style={{ animationDelay: `${i * 45}ms` }}
              key={label}
            >
              <div className={styles.metricTop}>
                <span>{label}</span>
                <div className={`${styles.metricIcon} ${styles[tone]}`}>
                  <Icon size={19} />
                </div>
              </div>
              <strong>{value}</strong>
              <small>{hint}</small>
            </article>
          ))}
      </div>
      <div className={styles.columns}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Ritmo de ventas</h2>
              <p>Últimos 14 días</p>
            </div>
            <span className={styles.pill}>Resumen diario</span>
          </div>
          {summary.today === null ? (
            <div className="empty-state">
              <ChartNoAxesCombined size={32} />
              <strong>Sin acceso a ventas</strong>
              <p>Tu rol no incluye la información comercial.</p>
            </div>
          ) : (
            <>
              <div className={styles.chartSummary}>
                <strong>{money(total)}</strong>
                <span>vendidos en este período</span>
              </div>
              {total > 0 ? (
                <div
                  className={styles.chart}
                  aria-label="Ventas de los últimos 14 días"
                >
                  {summary.trend.map((d) => (
                    <div key={d.day} className={styles.barColumn}>
                      <div className={styles.barTrack}>
                        <div
                          tabIndex={0}
                          className={styles.bar}
                          style={{
                            height: `${(Number(d.total) / max) * 100}%`,
                            minHeight: Number(d.total) > 0 ? 4 : 0,
                          }}
                          aria-label={`${d.day}: ${money(d.total)}`}
                        >
                          <span className={styles.tooltip}>
                            {d.day.slice(8)}/{d.day.slice(5, 7)} ·{" "}
                            {money(d.total)}
                          </span>
                        </div>
                      </div>
                      <small>{d.day.slice(8)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <ChartNoAxesCombined size={32} />
                  <strong>Tu próxima venta empieza acá</strong>
                  <p>
                    Cuando registres ventas, vas a poder seguir su evolución en
                    este gráfico.
                  </p>
                  {canSell && (
                    <button
                      className="secondary-button"
                      onClick={() => onNavigate("sales", true)}
                    >
                      Registrar una venta <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </article>
        <article className={styles.stockPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.eyebrow}>PARA TENER EN CUENTA</span>
              <h2>Tu inventario, al día</h2>
            </div>
            <Package size={23} />
          </div>
          {summary.lowStock === null ? (
            <p className={styles.stockText}>
              Tu rol no incluye acceso al inventario.
            </p>
          ) : summary.lowProducts.length ? (
            <>
              <p className={styles.stockText}>
                <strong>{summary.lowStock}</strong> productos alcanzaron su
                stock mínimo.
              </p>
              <div className={styles.stockList}>
                {summary.lowProducts.map((p) => (
                  <div key={p.id}>
                    <span>{p.name}</span>
                    <strong>
                      {p.stock} <small>un.</small>
                    </strong>
                  </div>
                ))}
              </div>
              <button onClick={() => onNavigate("products", false, "low")}>
                Revisar productos <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <div className={styles.stockEmpty}>
              <div>
                <Check size={26} />
              </div>
              <h3>Todo en orden</h3>
              <p>
                {summary.products === 0
                  ? "Agregá tus productos para empezar a controlar el stock."
                  : "No tenés productos por debajo del stock mínimo."}
              </p>
              <button onClick={() => onNavigate("products")}>
                Ver catálogo <ArrowRight size={16} />
              </button>
            </div>
          )}
        </article>
      </div>
      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Actividad reciente</h2>
            <p>Los últimos movimientos de tu equipo</p>
          </div>
          <Clock size={18} className="text-muted" />
        </div>
        {summary.activity.length ? (
          <div className={styles.timeline}>
            {summary.activity.map((a) => {
              const [entity, action] = a.action.split(".");
              return (
                <div key={a.id} className={styles.event}>
                  <span className={styles.eventIcon}>
                    <ArrowDownUp size={16} />
                  </span>
                  <div>
                    <strong>
                      {entityLabels[entity] ?? entity}{" "}
                      {actionLabels[action] ?? action}
                    </strong>
                    <small>
                      {new Date(a.date).toLocaleString("es-AR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </small>
                  </div>
                  <span className={styles.eventDot} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Clock size={28} />
            <strong>Un nuevo comienzo</strong>
            <p>
              La actividad disponible para tu rol aparecerá acá a medida que
              uses tu workspace.
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
