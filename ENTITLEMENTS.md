# Capacidades y uso

`features` distingue BOOLEAN y LIMIT; `plan_entitlements` resuelve por plan. `hasFeature`, `canUse`, `getLimit`, `enforceCapacity` y `consumeUsage` centralizan las decisiones. No se reparte lógica de nombres de planes por los módulos comerciales.

| Capacidad inicial | Free | Lite | Business | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| Usuarios | 1 | 5 | 25 | 100 |
| Clientes | 2.000 | 10.000 | 100.000 | 500.000 |
| Productos | 2.000 | 10.000 | 100.000 | 500.000 |
| Exportaciones CSV/mes | 10 | 100 | 1.000 | 10.000 |

Son valores iniciales configurables desde `/internal`, no compromisos comerciales definitivos. No existe límite «ilimitado». La disponibilidad de una función es independiente del beneficio comercial: analytics avanzado, automatizaciones y AI permanecen indisponibles aunque un plan tenga configurados beneficios futuros.

Las altas de clientes, productos y miembros bloquean la fila de organización antes de contar y crear para evitar superar límites por concurrencia. CSV consume cuota mensual UTC en la misma transacción de consulta y auditoría; una operación fallida revierte el consumo. `usage_records` conserva cada período. No se eliminan registros al bajar el límite.

Feature flags por usuario, organización y porcentaje quedan diseñados en DATABASE.md para una fase posterior; no se presentan como implementados.
