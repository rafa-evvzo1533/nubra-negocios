import Link from "next/link";
import { getAccountSession } from "@/server/auth";
import { applicationStatus } from "@/server/applications";
import { ApplicationForm } from "@/components/foundation/ApplicationForm";
import { PublicShell } from "@/components/foundation/PublicShell";
import s from "@/components/foundation/Foundation.module.css";
export default async function Page() {
  const account = await getAccountSession();
  return (
    <PublicShell>
      {account ? (
        <ApplicationForm
          data={JSON.parse(JSON.stringify(await applicationStatus()))}
        />
      ) : (
        <section className={s.hero}>
          <div>
            <span className={s.eyebrow}>
              Solicitud de alta · Nubra Negocios
            </span>
            <h1>Tu negocio empieza a organizarse acá.</h1>
            <p>
              Presentá tu empresa, emprendimiento o actividad profesional. Una
              vez aprobada, vas a poder gestionar clientes, ventas, stock y caja
              desde tu propio espacio.
            </p>
            <div className={s.actions}>
              <Link className="primary-button" href="/register">
                Crear cuenta y registrar negocio
              </Link>
              <Link className="secondary-button" href="/login">
                Ya tengo cuenta
              </Link>
            </div>
            <p>
              El registro es gratuito. No necesitás ingresar una tarjeta para
              solicitar acceso.
            </p>
          </div>
          <div className={s.visual}>
            <p>ASÍ DE SIMPLE</p>
            <h2>
              De tu primera cuenta
              <br />a tu propio workspace.
            </h2>
            {[
              "Creá tu cuenta y verificá el email",
              "Completá los datos de tu negocio",
              "Enviá la solicitud para revisión",
              "Recibí acceso al plan Free",
            ].map((v, i) => (
              <div className={s.step} key={v}>
                <span>0{i + 1}</span>
                {v}
              </div>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
