import Link from "next/link";
import type { ReactNode } from "react";
import s from "./Foundation.module.css";
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <Link className={s.brand} href="/">
          nubra. <small>NEGOCIOS</small>
        </Link>
        <div className={s.links}>
          <Link href="/plans">Planes y beneficios</Link>
          <Link href="/login">Ingresar</Link>
          <Link className="primary-button" href="/register-business">
            Registrar mi negocio
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
      <section className={s.hero}>
        <div>
          <span className={s.eyebrow}>Un lugar para gestionar tu negocio</span>
          <h1>El próximo paso de tu empresa empieza acá.</h1>
          <p>
            Clientes, productos, ventas y caja conectados. Una base clara para
            tomar decisiones, ordenar el trabajo y acompañar tu crecimiento.
          </p>
          <div className={s.actions}>
            <Link className="primary-button" href="/register">
              Crear cuenta y solicitar acceso →
            </Link>
            <Link href="/login">Ya tengo una cuenta</Link>
          </div>
          <p className={s.muted}>
            Acceso sujeto a revisión. Tu negocio comienza con Free una vez
            aprobado.
          </p>
        </div>
        <div className={s.visual}>
          <p>NUBRA NEGOCIOS</p>
          <h2>
            Tu operación.
            <br />
            Una visión más clara.
          </h2>
          {[
            "Creá y verificá tu cuenta",
            "Presentá los datos de tu negocio",
            "NUBRA revisa tu solicitud",
            "Comenzá a gestionar tu empresa",
          ].map((step, i) => (
            <div className={s.step} key={step}>
              <span>0{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </section>
      <section className={s.content}>
        <h2>Una plataforma, distintas etapas de crecimiento.</h2>
        <div className={s.plans}>
          {[
            [
              "Free",
              "Para empezar a ordenar tu negocio.",
              "Clientes, productos, inventario, ventas y caja.",
            ],
            [
              "Lite",
              "Más capacidad para tu equipo.",
              "Disponible también con el paquete Nubra Basic.",
            ],
            [
              "Business",
              "Para empresas en crecimiento.",
              "Mayor capacidad de usuarios, clientes y catálogo.",
            ],
            [
              "Enterprise",
              "Capacidad acorde a tu operación.",
              "Disponible también con el paquete Nubra Enterprise.",
            ],
          ].map(([name, description, detail]) => (
            <article className={s.card} key={name}>
              <span className={s.eyebrow}>{name}</span>
              <h3>{description}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
