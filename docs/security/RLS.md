# Aislamiento PostgreSQL

Implementación: migración `0007_security_boundaries.sql`, `src/server/postgres.ts` y `request-context.ts`.

Cada petición comienza con AsyncLocalStorage vacío. La sesión se valida en servidor y vincula usuario y organización. Cada consulta usa una transacción, `SET LOCAL ROLE nubra_runtime` y variables `app.organization_id`, `app.user_id`, `app.support_grant_id`, `app.staff_id`. COMMIT/ROLLBACK elimina el contexto; nunca se usa SET de alcance de conexión. No se exporta el pool sin restricciones.

Hay ENABLE y FORCE ROW LEVEL SECURITY en clientes, productos, ventas, partidas, movimientos de stock, actividades, presupuestos, comprobantes, pagos, caja, tablas fiscales, enlaces privados, claves empresariales y auditoría empresarial. La política exige empresa activa/aprobada y membresía real del usuario. Una consulta sin WHERE no puede devolver otro negocio. El RBAC por módulo/acción se comprueba además en la aplicación; RLS no sustituye estos permisos.

Las políticas SELECT de soporte requieren grant persistido, personal activo, alcance, negocio activo, vencimiento y ausencia de revocación. No conceden INSERT/UPDATE/DELETE. La minimización de columnas se aplica en consultas explícitas del servicio de soporte; RLS por sí sola no oculta columnas.

Autenticación, organizaciones, membresías, permisos, catálogo, suscripciones, solicitudes, grants y auditoría de plataforma pertenecen al plano de control. No tienen RLS empresarial para permitir autenticación/aprobación antes de tener membresía. Sus rutas aplican autorización específica. Una credencial SQL comprometida podría afectar ese plano: no se presenta RLS como protección contra ejecución arbitraria de SQL ni contra el administrador de base.

`DATABASE_URL` debe ser un LOGIN sin SUPERUSER, BYPASSRLS, propiedad de tablas, CREATEDB ni CREATEROLE, miembro NOINHERIT de `nubra_runtime`. `scripts/provision-runtime.mjs` aprovisiona este rol para PostgreSQL local. `MIGRATION_DATABASE_URL` es exclusiva de tareas de despliegue. El runner omite esa credencial en el entorno del servidor Next. En producción usar inyección separada de secretos, sin un archivo .env compartido con migraciones.

Las políticas no son una barrera para superusuarios; FORCE incluye al propietario salvo privilegios de bypass. Referencia: [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Pruebas reproducibles: `npm run build` y `node tests/run-suite.mjs security`. Incluyen consulta deliberadamente sin filtro, contexto ausente, empresa/usuario incompatibles, escritura cruzada, limpieza del contexto y prohibición de modificar auditorías.
