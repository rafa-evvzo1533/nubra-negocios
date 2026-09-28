# Capacidades y uso

`features` distingue BOOLEAN y LIMIT; `plan_entitlements` resuelve por plan. `hasFeature`, `canUse`, `getLimit`, `enforceCapacity` y `consumeUsage` centralizan las decisiones. No se reparte lógica de nombres de planes por los módulos comerciales.

| Capacidad inicial | Free | Lite | Business | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| Usuarios | 1 | 3 | 15 | 100 |
| Clientes | 50 | 500 | 10.000 | 500.000 |
| Productos | 100 | 1.000 | 10.000 | 500.000 |
| Proveedores | 10 | 100 | 1.000 | 100.000 |
| Ventas/mes | 100 | 1.000 | 10.000 | 100.000 |
| Exportaciones CSV/mes | 2 | 20 | 200 | 2.000 |

Free no vence. Al alcanzar el límite, la creación que lo supera queda bloqueada y se indica ampliar el plan. Se conservan los datos, la lectura y las demás operaciones que aún tengan capacidad. Las ventas y exportaciones se renuevan por mes calendario UTC. Los registros existentes que ya superen la nueva capacidad no se borran. Los proveedores archivados cuentan dentro del total.

Son valores iniciales configurables desde `/internal`, no compromisos comerciales definitivos. No existe límite «ilimitado». La disponibilidad de una función es independiente del beneficio comercial: analytics avanzado, automatizaciones y AI permanecen indisponibles aunque un plan tenga configurados beneficios futuros.

Las altas de clientes, productos, proveedores y miembros bloquean la fila de organización antes de contar y crear para evitar superar límites por concurrencia. CSV y ventas (directas, rápidas, conversión de presupuesto o comprobante) consumen cuota mensual UTC en la misma transacción; una operación fallida revierte el consumo. Reintentos idempotentes no consumen de nuevo. Cancelar una venta no devuelve cuota de emisión. `usage_records` conserva cada período. Reportes básicos y cuenta corriente están disponibles en los cuatro planes según los permisos del usuario.

Feature flags por usuario, organización y porcentaje quedan diseñados en DATABASE.md para una fase posterior; no se presentan como implementados.
