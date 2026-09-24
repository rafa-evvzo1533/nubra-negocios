> Actualización posterior: ver [DELIVERY_UPDATE.md](DELIVERY_UPDATE.md). Mercado Pago, roles propios, invitaciones y mejoras visuales ya están implementados; las menciones a proveedor futuro de este informe describen la entrega inicial.

# Entrega · Foundation comercial de Nubra Negocios

## Resultado

Se auditó el repositorio y se extendió el core real existente. La web pública ahora permite crear cuenta, verificar email, presentar negocio, aceptar documentos versionados y enviar una solicitud. NUBRA revisa desde un panel separado y aprueba de forma transaccional: crea empresa, propietario y Free, registrando actor y fecha. La persona pendiente o suspendida puede consultar su estado, pero no accede a datos empresariales.

Los cuatro planes resuelven capacidades y límites desde PostgreSQL. El panel permite concesión comercial, cambio de origen/plan, suspensión, bloqueo y edición de beneficios. La empresa consulta plan, consumo y opciones, y puede solicitar un cambio que se registra sin cobro automático.

El core preservado tiene dashboard, clientes/seguimiento, productos, stock, presupuestos, ventas, pagos y caja. Este bloque agrega idempotencia a ventas directas, cancelación de ventas sin cobros con restitución de stock, historial before/after/actor y exportación CSV aislada/auditada con cuota.

## Arquitectura

Next.js 16 App Router + React + TypeScript strict; monolito modular; PostgreSQL/pg; Zod; CSS Modules. Se conservó la arquitectura existente. Prisma es un diseño heredado sin ejecución, señalado explícitamente en su archivo. El modelo final previsto está en DATABASE.md. No se introdujeron microservicios, un proveedor de pagos ni funciones AI falsas.

La fuente del esquema son migraciones SQL explícitas. El runtime solo comprueba la versión. Cuenta pública, identidad interna y contexto empresarial son dominios de autorización separados.

## Archivos creados en este bloque

- `migrations/0000_baseline.sql`, `0003_saas_foundation.sql`, `0004_legal_drafts.sql`.
- `scripts/bootstrap-admin.mjs`.
- `src/server/registration.ts`, `applications.ts`, `subscriptions.ts`, `rbac.ts`, `legal.ts`, `billing.ts`, `sales.ts`.
- `src/domain/csv.ts`.
- `src/components/foundation/`: PublicShell, AccountForms, ApplicationForm, InternalConsole, SubscriptionView, LegalPage y Foundation.module.css.
- Páginas `src/app/register`, `verify-email`, `onboarding`, `internal`, `privacy`, `terms`, `settings/subscription`.
- Rutas `src/app/api/auth/register`, `auth/verify-email`, `v1/application`, `v1/subscription`, `v1/exports/[resource]`, `v1/sales/[id]/cancel`, `health` y `internal/admin/{applications,organizations,plans,audit}` con acciones por ID.
- `tests/run-suite.mjs`, `tests/foundation.mjs`, `tests/csv.test.mjs`.
- `REPOSITORY_AUDIT.md`, `MULTI_TENANCY.md`, `RBAC.md`, `SUBSCRIPTIONS.md`, `ENTITLEMENTS.md`, `CRM.md`, `INVENTORY.md`, `CASH.md`, `LEGAL.md`, `ADMIN_PANEL.md`, `TESTING.md`, `DELIVERY.md`.

## Archivos existentes modificados

- `package.json`: comandos setup:admin, test:foundation y test:all; sin dependencias nuevas.
- `.env.example`: configuración de correo también para registro/verificación.
- `scripts/migrate.mjs`: bloqueo de despliegues concurrentes.
- `src/server/postgres.ts`: se retiró DDL de peticiones; verificación de versión.
- `src/server/auth.ts`, `admin.ts`, `mail.ts`, `http.ts`: identidad de cuenta/personal, correo, auditoría, validación y límites de JSON.
- `src/server/business.ts`, `transactions.ts`, `finance.ts`, `dashboard.ts`, `members.ts`, `access.ts`, `permissions.ts`, `tenant.ts`: cuotas, permisos, roles, stock e idempotencia; exclusión de ventas canceladas de métricas y cobros.
- Rutas de login/logout de usuarios y administradores y administración de empresas: sesiones identificadas, auditoría, estado y suscripción inicial.
- `src/proxy.ts`, `src/app/layout.tsx`, `page.tsx`, `globals.css`, `login/page.tsx`: CSP/headers, renderizado dinámico, web pública, identidad visual y enlace de registro.
- `src/components/Workspace.tsx`, `admin/AdminView.tsx`, `business/{Composer,BusinessModule,RecordDetail,client}.tsx/ts`: acceso a plan/panel, clave de reintentos, descarga CSV, cancelación y estados.
- `tests/integration.mjs`, `tests/operations.mjs`: contratos actuales de idempotencia, permisos por plan y sesión de cuenta separada del workspace.
- README, ARCHITECTURE, DATABASE, SECURITY, API, ROADMAP, MIGRATIONS y BACKUP; anotación de diseño no operativo en `prisma/schema.prisma`.

El repositorio ya tenía cambios sin commit y archivos sin seguimiento al iniciar. Este listado describe el bloque realizado; `git diff` por sí solo incluye también trabajo previo del usuario. No se hicieron commits ni se descartó ese trabajo.

## Migraciones y endpoints

Se aplicaron 0000, 0003 y 0004 en la base local existente; 0001 y 0002 ya estaban aplicadas. Sobre bases de prueba vacías se ejecutó la secuencia completa y se repitió el runner sin cambios pendientes. No se borraron datos empresariales existentes.

Los contratos completos de endpoints están en API.md. Nuevos grupos: registro/verificación, solicitud propia, suscripción propia, exportación CSV, cancelación, health y administración interna bajo `/api/internal/admin`. Se conservan APIs operativas `/api/v1` y las rutas heredadas de SUPER_ADMIN `/api/admin`.

## Funciones y pantallas

Funciones nuevas principales: registerAccount, resendVerification, verifyEmail, getAccountSession, getStaffSession, saveApplication, approveOrganizationApplication, rejectOrganizationApplication, requestOrganizationInformation, startApplicationReview, suspendOrganization, reactivateOrganization, changeOrganizationPlan, grantSubscription, revokeSubscription, hasFeature, canUse, getLimit, enforceCapacity, consumeUsage, requestUpgrade, requirePermission y cancelSale. Las operaciones tienen persistencia, autorización y errores; no son solo botones.

Pantallas nuevas: landing, registro, verificación, datos/estado de solicitud, administración interna, suscripción y consumo, privacidad y términos. Se preservaron layout empresarial, dashboard, clientes, productos, stock, ventas, presupuestos y caja con datos reales.

## Verificación ejecutada

| Control | Resultado |
| --- | --- |
| Instalación | No necesaria: dependencias instaladas, sin nuevas dependencias |
| Migraciones locales | Aplicadas; segundo pase sin pendientes |
| Esquema en base vacía + replay | Correcto, runner con bloqueo transaccional |
| npm run lint | Correcto, sin errores ni advertencias ESLint |
| npm run typecheck | Correcto |
| npm run build | Correcto, rutas dinámicas y CSP |
| Unitarias CSV | 3 aprobadas |
| Foundation | 91 aserciones y E2E con SMTP local |
| Integración core | 144 aserciones |
| Operaciones | 64 aserciones, recuperación, OCR real, caja, equipo y admin |
| Navegador core | Login, CRM, stock, venta múltiple, presupuesto, búsqueda y móvil aprobados |

La suite utiliza credenciales aleatorias, SMTP local y una base generada que elimina al finalizar. No envía correo externo ni usa registros empresariales existentes. Node emite una advertencia informativa al detectar el módulo TypeScript del test unitario; no afecta el resultado.

## Problemas encontrados y resueltos

- Falta de baseline para instalar en base vacía: se extrajo el esquema existente sin alteración destructiva.
- Credencial interna sin actor: ahora hay personal persistido con roles y auditoría.
- Parametrización ambigua PostgreSQL en consumo: se añadieron casts de UUID/integer y se comprobó contra base real.
- Las pruebas antiguas asumían ventas sin clave de reintento y rechazo de cualquier login suspendido: ahora comprueban el nuevo contrato y que una cuenta suspendida no acceda al core.
- No se sobrescribió la contraseña administrativa local recibida: debe cumplir 12 caracteres para aprovisionar la nueva identidad interna.

## Riesgos, deuda y próximo bloque

Para usar registro en el entorno local hay que configurar SMTP. Para entrar al panel con la nueva identidad: configurar una contraseña administrativa válida y ejecutar `npm run setup:admin`. Estas credenciales y la habilitación de correo externo no se inventaron.

Antes de comercializar: MFA/recuperación de personal, invitaciones seguras, permisos de acción granulares y roles personalizados, reaceptación legal para empresas activas, outbox de correo/notificaciones, límites de infraestructura y defensa adicional contra abuso, observabilidad y restauración probada. Legal conserva `LEGAL_REVIEW_REQUIRED`; requiere identidad/contacto/retención definitivos y revisión jurídica.

Todavía no están implementados: múltiples depósitos/sucursales, variantes/servicios completos, transferencias, devoluciones de ventas cobradas, compras/proveedores/tareas/agenda completos, importación CSV, onboarding guiado con logo, cierre/eliminación, AI, automatizaciones, analytics avanzado, webhooks, checkout ni emisión fiscal productiva. El catálogo identifica lo futuro y no lo habilita por el solo hecho de asignar un plan.

Próximo bloque recomendado: cerrar foundation de equipo y seguridad (invitaciones, MFA, permisos granulares, reaceptación legal y outbox). Luego ampliar stock por depósito y devoluciones con pagos. Esta entrega no se declara como la totalidad del SaaS ni lista para producción sin esos controles.
