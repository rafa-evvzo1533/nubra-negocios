# Arquitectura

## Decisión

Monolito modular Next.js App Router, React, TypeScript strict y PostgreSQL mediante pg. Se conserva el acceso SQL que sostiene el core existente. CSS Modules mantiene el lenguaje visual; Tailwind está disponible. No se agrega una segunda librería de UI ni se sustituye el ORM durante esta migración funcional. Se eliminaron Prisma y su esquema heredado sin uso; la fuente del esquema continúa en `migrations/`.

## Límites de confianza

Navegador → proxy (origen, CSP, headers) → Route Handler → autorización y validación → servicio de dominio → transacción PostgreSQL. Las cookies contienen un token aleatorio; en base solo existe su hash. Proxy no sustituye autorización de backend.

Cuenta pública y workspace son contextos diferentes. getAccountSession permite gestionar la solicitud propia. getUserSession exige membresía activa, empresa aprobada e identidad pública verificada. staff_users y cookie administrativa constituyen otro dominio de identidad; nunca confieren membresía empresarial.

## Dominios activos

- auth / registration / recovery: identidad, sesiones, verificación y correo.
- applications / admin: revisión y activación transaccional.
- subscriptions / rbac / legal: capacidades comerciales, permisos y aceptación.
- business / crm / quotes: CRUD, seguimiento y documentos.
- transactions / sales / finance: stock, ventas, pagos y caja.
- dashboard: agregados respetando rol y organización.
- receipts / fiscal: importación OCR local y puerto fiscal existente (sin producción).

La carpeta src/components/foundation contiene web pública, solicitud, panel interno y suscripción. Workspace conserva la experiencia operativa. Los componentes visuales antiguos que no se montan no se presentan como funciones implementadas.

## Persistencia y concurrencia

migrations/*.sql es la única fuente operativa del esquema. migrate.mjs bloquea mediante advisory lock, ejecuta archivos pendientes en transacción y conserva schema_migrations. El runtime solo verifica la versión esperada, sin DDL. El despliegue debe separar usuario migrador de usuario de aplicación con permisos DML.

Aprobación bloquea solicitud. Consumo, altas con cuota, pagos, cancelaciones y ventas directas serializan por organización donde corresponde. Stock bloquea productos y usa actualización condicional. Los importes siguen en centavos enteros y las fechas en TIMESTAMPTZ/DATE. La auditoría de mutaciones críticas forma parte de la transacción.

## Extensión prevista

BillingProvider es un contrato sin proveedor activo. Para S3/antivirus, jobs/outbox, notificaciones, AI y webhooks se crearán adaptadores y dominios separados, sin acoplar autorización al proveedor. Agregar BullMQ/Redis cuando los trabajos requieran reintentos persistentes; no enviar operaciones de negocio al navegador. AIGateway futuro deberá recibir el mismo contexto y permisos.

Las APIs del core están bajo /api/v1; administración nueva bajo /api/internal/admin. /api/admin permanece para compatibilidad con el panel de accesos existente, restringido a SUPER_ADMIN. Ver DATABASE.md para diseño final por fases.
