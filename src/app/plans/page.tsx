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
            Empezá simple.
            <br />
            Crecé con más posibilidades.
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
                Sí. Creá tu cuenta, verificá tu email y presentá tu negocio.
                Tras la aprobación, comenzás en Free sin ingresar una tarjeta.
              </p>
              <h3>¿Cómo se paga?</h3>
              <p>
                Desde la sección de suscripciones de tu negocio. Cuando el plan
                tenga un precio habilitado, podrás pagar en Mercado Pago por un
                período de 30 días.
              </p>
            </div>
            <div>
              <h3>¿Qué ocurre con mis datos al cambiar?</h3>
              <p>
                Los datos de tu negocio se conservan. Si alcanzás un límite, se
                restringen las nuevas altas hasta que tengas capacidad
                disponible.
              </p>
              <h3>¿Las funciones futuras ya están incluidas?</h3>
              <p>
                Acá se muestran las funciones disponibles. Los módulos de AI,
                automatizaciones y analytics avanzado se anunciarán cuando estén
                listos.
              </p>
            </div>
          </div>
        </section>
      </section>
    </PublicShell>
  );
}
