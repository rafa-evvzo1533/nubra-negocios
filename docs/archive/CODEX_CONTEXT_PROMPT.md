# Continuidad de Nubra Negocios

Continuar en este repositorio como SaaS independiente. Nubra Base, Tienda Nubra y Nubra AI siguen siendo productos separados.

## Estado actual

Next.js 16 App Router, TypeScript strict, CSS Modules, Zod y PostgreSQL con `pg`. Leer las guías locales de Next antes de editar. Prisma sigue siendo diseño parcial; no asumir cliente generado ni ejecutar db push sobre el esquema real.

- `/admin`: acceso Nubra mediante entorno y alta de empresa, usuario y OWNER.
- `/login`: acceso de empresa sin registro público.
- `/`: Server Component valida sesión y membresía, carga workspaces y dashboard real.
- `src/proxy.ts`: redirección preliminar y comprobación de origen para mutaciones.
- Cookies HttpOnly, sesiones hash SHA-256 en DB, Argon2id con compatibilidad de hashes scrypt anteriores, expiración de ocho horas y logout revocable.
- Workspace activo en `sessions.organization_id`; cambio validado por membresía.
- CRUD clientes/productos, carrito de ventas e inventario; RBAC, Zod y auditoría.
- Búsqueda global Ctrl/Cmd+K, filtros y paginación PostgreSQL.
- CRM con estados, próximo contacto e historial de notas/llamadas/reuniones/emails.
- Presupuestos con precios históricos, vencimiento, estados y conversión a venta idempotente.
- Diseño responsive con gráfico real de 14 días, paneles laterales, animaciones y movimiento reducido.
- Claves externas compuestas impiden relaciones entre organizaciones.
- `src/server/postgres.ts` es la fuente del esquema activo idempotente.
- `migrations/0001_security_and_fiscal_foundation.sql` y `scripts/migrate.mjs` agregan migraciones SQL versionadas para reset tokens, rate limits y fiscalidad; aplicar con `npm run migrate`.
- `src/server/auth.ts` aplica rate limiting persistente a login admin/empresa.
- `src/server/fiscal` define `FiscalProvider` y un adaptador ARCA WSFEv1 de homologación sin emisión real.
- `GET /api/v1/fiscal/status` informa capacidades fiscales a usuarios autorizados.
- `Workspace.tsx` y `components/business` son la interfaz activa. Los anteriores componentes layout/dashboard/overlays están conservados pero no montados.

## Reglas

No mostrar secretos de `.env`, no generar datos demo ni registro público. El organizationId siempre se deriva de sesión. Mantener consultas y relaciones aisladas, y no acoplar otros productos Nubra.

## Validación

`npm run lint`, `npm run typecheck`, `npm run build`. Para integración, iniciar `npm run start -- --port 3100` y ejecutar `npm run test:integration` y `npm run test:browser` (Edge instalado, o PLAYWRIGHT_CHANNEL=chrome). El script usa dos empresas temporales, verifica aislamiento/RBAC/stock/sesiones y limpia sus propios registros. No usarlo contra producción.

## Próximo bloque recomendado

Recuperación de contraseña con proveedor de entrega autorizado, administración de membresías/roles, pagos y caja. Luego oportunidades CRM, cancelaciones y edición/envío de presupuestos. Para ARCA leer `ARCA.md`: no emitir en producción sin certificado X.509, asociación al WSN, decisiones contables y credenciales de homologación. Consultar API.md, DATABASE.md, SECURITY.md y ROADMAP.md.
