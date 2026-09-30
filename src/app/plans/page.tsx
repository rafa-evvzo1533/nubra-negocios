import { planCatalog } from "@/server/subscriptions";
import { PublicShell } from "@/components/foundation/PublicShell";
import { PlanCards } from "@/components/foundation/PlanCards";
import s from "@/components/foundation/Foundation.module.css";
export default async function Page() {
  return (
    <PublicShell>
      <section className={s.content}>
        <div className={s.pricingIntro}>
          <span className={s.eyebrow}>Planes que acompañan tu crecimiento</span>
          <h1>
            Planes para cada etapa
            <br />
            de tu negocio.
          </h1>
          <p>
            Elegí la capacidad que necesita tu negocio. Clientes, productos,
            ventas y caja en todos los planes. Precios claros y beneficios que
            podés comparar.
          </p>
        </div>
        <PlanCards plans={JSON.parse(JSON.stringify(await planCatalog()))} />
        <section className={s.card} style={{ marginTop: 32 }}>
          <h2>Antes de elegir tu plan</h2>
          <div className={s.grid}>
            <div>
              <h3>¿Puedo comenzar gratis?</h3>
              <p>
                Sí. Tras verificar tu email y aprobarse tu negocio, comenzás en
                Free. Podés reclamar una prueba de Business por 14 días, una
                sola vez, sin tarjeta. Al terminar volvés a Free
                automáticamente.
              </p>
              <h3>¿Cómo se paga?</h3>
              <p>
                Desde la sección de suscripciones de tu negocio. Cuando el plan
                tenga un precio habilitado, podrás pagar en Mercado Pago por un
                mes con renovación automática o un año completo en un pago
                único.
              </p>
            </div>
            <div>
              <h3>¿Qué ocurre con mis datos al cambiar?</h3>
              <p>
                Los datos de tu negocio se conservan. Si alcanzás un límite, se
                restringen las nuevas altas hasta que tengas capacidad
                disponible.
              </p>
              <h3>¿La renovación es automática?</h3>
              <p>
                El plan mensual se cobra automáticamente cada mes hasta que
                canceles desde Suscripciones. El anual es un pago único. La
                prueba gratuita finaliza sola y no genera cobros.
              </p>
            </div>
          </div>
        </section>
      </section>
    </PublicShell>
  );
}
