"use client";

import {
  ArrowUpRight,
  CircleDollarSign,
  FileText,
  MoreHorizontal,
  Package,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import styles from "./DashboardView.module.css";

type DashboardViewProps = { onCopilotOpen: () => void };
const metrics = [
  { label: "Ventas de hoy", icon: CircleDollarSign, tone: "mint" },
  { label: "Ventas del mes", icon: TrendingUp, tone: "blue" },
  { label: "Clientes activos", icon: Users, tone: "yellow" },
  { label: "Pedidos abiertos", icon: Package, tone: "coral" },
] as const;

export function DashboardView({ onCopilotOpen }: DashboardViewProps) {
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>RESUMEN DEL WORKSPACE</p>
          <h1>
            Tu negocio, en un solo lugar <span>✦</span>
          </h1>
          <p className={styles.subtitle}>
            Conecta una organización para comenzar a ver información real.
          </p>
        </div>
        <button className={styles.primary}>
          <Plus size={17} /> Nueva venta
        </button>
      </div>
      <section className={styles.metrics} aria-label="Indicadores principales">
        {metrics.map(({ label, icon: Icon, tone }) => (
          <article className={styles.metric} key={label}>
            <div className={`${styles.metricIcon} ${styles[tone]}`}>
              <Icon size={19} />
            </div>
            <div className={styles.metricMeta}>
              <span>{label}</span>
              <strong>—</strong>
              <small>Sin datos todavía</small>
            </div>
            <button
              className={styles.cardMenu}
              aria-label={`Mas opciones de ${label}`}
            >
              <MoreHorizontal size={17} />
            </button>
          </article>
        ))}
      </section>
      <section className={styles.twoColumns}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Ritmo de ventas</h2>
              <p>Los datos aparecerán después de registrar ventas.</p>
            </div>
          </div>
          <div className={styles.emptyState}>
            <TrendingUp size={25} />
            <strong>Aún no hay ventas</strong>
            <span>
              Las métricas se calcularán desde la base de datos de tu
              organización.
            </span>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div className={styles.briefTitle}>
              <div className={styles.sparkle}>
                <Sparkles size={16} />
              </div>
              <div>
                <h2>Business Brief</h2>
                <p>Resumen basado en datos reales</p>
              </div>
            </div>
          </div>
          <div className={styles.emptyState}>
            <Sparkles size={25} />
            <strong>Brief pendiente</strong>
            <span>
              Nubra AI podrá analizar tu negocio cuando haya actividad
              disponible.
            </span>
            <button className={styles.textButton} onClick={onCopilotOpen}>
              Abrir Nubra AI <ArrowUpRight size={15} />
            </button>
          </div>
        </article>
      </section>
      <section className={styles.twoColumns}>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Actividad reciente</h2>
              <p>Eventos de tu organización</p>
            </div>
          </div>
          <div className={styles.emptyState}>
            <FileText size={25} />
            <strong>Sin actividad registrada</strong>
            <span>
              Las acciones aparecerán aquí después de usar el workspace.
            </span>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Tus prioridades</h2>
              <p>Tareas de tu organización</p>
            </div>
          </div>
          <div className={styles.emptyState}>
            <Package size={25} />
            <strong>No hay tareas cargadas</strong>
            <span>Las prioridades se consultarán desde la base de datos.</span>
          </div>
        </article>
      </section>
    </div>
  );
}
