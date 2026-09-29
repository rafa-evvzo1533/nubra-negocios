import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Package,
  Users,
  ShoppingBag,
  Wallet,
  FileText,
  ShieldCheck,
  Check,
  Layers3,
} from "lucide-react";
import { Brand } from "../ui/Brand";
import s from "./Foundation.module.css";
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className={s.page}>
      <nav className={s.nav} aria-label="Navegación principal">
        <Link href="/" aria-label="Nubra Negocios · Inicio">
          <Brand size={88} />
        </Link>
        <div className={s.links}>
          <Link href="/#producto">Producto</Link>
          <Link href="/plans">Planes y beneficios</Link>
          <Link href="/login">Ingresar</Link>
          <Link className="primary-button" href="/register-business">
            Registrar mi negocio <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      {children}
      <footer className={s.footer}>
        <span>© NUBRA NEGOCIOS</span>
        <Link href="/privacy">Privacidad</Link>
        <Link href="/terms">Términos de uso</Link>
      </footer>
    </main>
  );
}
export function Landing() {
  return (
    <PublicShell>
      <section className={`${s.hero} ${s.landingHero}`}>
        <div>
          <span className={s.heroLabel}>
            <span /> TU NEGOCIO. TODO CONECTADO.
          </span>
          <h1>
            Menos vueltas.
            <br />
            Más control.
            <br />
            <em>Tu próximo nivel.</em>
          </h1>
          <p>
            Clientes, productos, ventas y caja en un mismo lugar. Organizá la
            operación de hoy y prepará tu negocio para lo que viene.
          </p>
          <div className={s.actions}>
            <Link className="primary-button" href="/register-business">
              Crear mi negocio <ArrowUpRight size={18} />
            </Link>
            <Link className="secondary-button" href="/#producto">
              Conocer la plataforma <ArrowRight size={16} />
            </Link>
          </div>
          <div className={s.trust}>
            <span>
              <Check size={15} />
              Comenzá con Free
            </span>
            <span>
              <Check size={15} />
              Sin tarjeta
            </span>
            <span>
              <Check size={15} />
              Acceso sujeto a aprobación
            </span>
          </div>
        </div>
        <div className={s.productVisual}>
          <div className={s.visualTop}>
            <span>
              <Layers3 size={16} /> Tu centro de operaciones
            </span>
            <span className={s.badge}>NUBRA</span>
          </div>
          <div className={s.visualBrand}>
            <Brand size={190} />
            <div>
              <span className={s.eyebrow}>Una visión más clara</span>
              <h2>
                Todo encuentra
                <br />
                su lugar.
              </h2>
            </div>
          </div>
          <div className={s.modulePreview}>
            {[
              [Users, "Clientes", "Relaciones que crecen"],
              [Package, "Inventario", "Cada unidad cuenta"],
              [ShoppingBag, "Ventas", "Operaciones conectadas"],
              [Wallet, "Caja", "Movimientos claros"],
            ].map(([Icon, title, description]) => {
              const I = Icon as typeof Users;
              return (
                <div key={String(title)}>
                  <I size={20} />
                  <span>
                    <strong>{String(title)}</strong>
                    <small>{String(description)}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </div>
              );
            })}
          </div>
          <p className={s.visualCaption}>
            Un espacio de trabajo propio para cada negocio.
          </p>
        </div>
      </section>
      <section id="producto" className={s.marketingSection}>
        <div className={s.sectionIntro}>
          <span className={s.eyebrow}>HECHO PARA EL TRABAJO REAL</span>
          <h2>
            Las partes de tu negocio.
            <br />
            Una sola plataforma.
          </h2>
          <p>Pasá de una operación a la siguiente sin perder el contexto.</p>
        </div>
        <div className={s.featureGrid}>
          {[
            [
              Users,
              "Clientes y seguimiento",
              "Contactos, leads y actividades para acompañar cada relación.",
            ],
            [
              Package,
              "Productos e inventario",
              "Cantidades disponibles, alertas de mínimo e historial de movimientos.",
            ],
            [
              ShoppingBag,
              "Ventas conectadas",
              "Registrá ventas con sus productos y actualizá el stock en la misma operación.",
            ],
            [
              Wallet,
              "Pagos y caja",
              "Cobros, ingresos y egresos con un registro claro de cada movimiento.",
            ],
            [
              FileText,
              "Presupuestos",
              "Prepará propuestas y convertí las aceptadas en ventas.",
            ],
            [
              ShieldCheck,
              "Equipo y permisos",
              "Invitá a tu equipo y definí qué puede ver y modificar cada persona.",
            ],
          ].map(([Icon, title, description]) => {
            const I = Icon as typeof Users;
            return (
              <article className={s.featureCard} key={String(title)}>
                <I size={22} />
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className={s.securityBand}>
        <ShieldCheck size={34} />
        <div>
          <span className={s.eyebrow}>TU INFORMACIÓN, CON CONTROLES</span>
          <h2>Un espacio propio. Accesos definidos.</h2>
          <p>
            Los permisos se validan en el servidor. Cada negocio trabaja con su
            información y conserva el control sobre su equipo.
          </p>
        </div>
        <Link className="secondary-button" href="/privacy">
          Conocer nuestra política <ArrowUpRight size={16} />
        </Link>
      </section>
      <section className={s.marketingSection}>
        <div className={s.sectionIntro}>
          <span className={s.eyebrow}>EMPEZAR ES SIMPLE</span>
          <h2>Del registro a tu operación diaria.</h2>
        </div>
        <div className={s.stepsGrid}>
          {[
            ["01", "Creá tu cuenta", "Verificá tu email para continuar."],
            [
              "02",
              "Presentá tu negocio",
              "Completá los datos y enviá tu solicitud.",
            ],
            [
              "03",
              "Recibí la aprobación",
              "NUBRA revisa la solicitud y te informa el estado.",
            ],
            [
              "04",
              "Empezá con Free",
              "Cargá tu catálogo, tus clientes y tu equipo según el plan.",
            ],
          ].map(([n, title, description]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={s.finalCta}>
        <span className={s.eyebrow}>CRECER TAMBIÉN ES ORGANIZARSE</span>
        <h2>
          Tu negocio tiene futuro.
          <br />
          Dale un lugar para crecer.
        </h2>
        <p>Conocé los planes y elegí la capacidad que necesitás.</p>
        <div className={s.actions}>
          <Link href="/plans" className="primary-button">
            Ver planes y beneficios <ArrowUpRight size={17} />
          </Link>
          <Link href="/register-business" className="secondary-button">
            Registrar mi negocio
          </Link>
        </div>
      </section>
      <section className={s.marketingSection}>
        <div className={s.sectionIntro}>
          <span className={s.eyebrow}>ANTES DE EMPEZAR</span>
          <h2>Preguntas frecuentes</h2>
        </div>
        <div className={s.faq}>
          {[
            [
              "¿Necesito una tarjeta para registrarme?",
              "No. Podés presentar tu negocio sin tarjeta. Una vez aprobado, empezás con el plan Free.",
            ],
            [
              "¿Puedo sumar a mi equipo?",
              "Sí. El propietario puede invitar personas por email y asignarles roles, respetando los lugares disponibles en su plan.",
            ],
            [
              "¿Mis datos se pierden al cambiar de plan?",
              "Los datos se conservan. Si se supera un límite, se restringen nuevas altas hasta contar con capacidad.",
            ],
            [
              "¿Cómo se contrata un plan?",
              "Desde Planes y suscripción podés consultar beneficios y contratar los planes habilitados mediante Mercado Pago.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
