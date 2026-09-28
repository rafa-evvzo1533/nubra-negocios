# Auditoría de seguridad · estado antes de esta intervención

Alcance: App Router Next 16.3.5, React 19, TypeScript estricto, PostgreSQL mediante pg, Zod, CSS Modules/Tailwind y Lucide. Prisma existe como diseño heredado, no se usa en runtime. Se inspeccionaron rutas, servicios, migraciones, pruebas, sesiones, recibos, facturación y paneles.

## Critical

- La conexión local usa un rol PostgreSQL superusuario/BYPASSRLS; no hay políticas RLS en tablas empresariales. Los filtros application-side son la única barrera frente a consultas equivocadas. Implementar rol de runtime no privilegiado, contexto transaccional y políticas FORCE RLS; separar credenciales de migración.

## High

- Personal SUPER_ADMIN puede asignar membresías a cuentas existentes en empresas desde APIs heredadas: eso permite otorgarse acceso indirecto. Retirar vinculación administrativa no consentida en producción; conservar aprovisionamiento inicial de empresa y gestión de metadata, trasladar altas a invitaciones del propietario.
- No hay acceso temporal de soporte aprobado por el dueño ni alcance por recurso. No crear impersonación; implementar solicitudes, grants, expiración y revocación con auditoría.
- No hay cifrado de campos a nivel aplicación ni proveedor de claves. No afirmar zero-knowledge. Implementar interfaces y AES-GCM con claves externas; migración de datos sensibles y proveedor KMS productivo deben verificarse como fase separada.

## Medium

- Contraseñas usan scrypt; migrar altas/reset a Argon2id, conservando verificación compatible y actualización de hashes al iniciar sesión.
- No hay pantalla de sesiones ni revocación selectiva. Sesiones actuales tienen expiración, cookies HttpOnly y tokens hashed.
- Recibos son BYTEA privados con autorización, pero no hay URLs firmadas temporales ni auditoría de lectura. No existen buckets públicos ni uploads genéricos.
- No hay sanitizador central de logs. Errores ya son genéricos; agregar redacción recursiva de secretos y PII.
- Rol SALES puede consultar caja agregada; separar finanzas de creación de ventas.
- Inventario registra movimientos transaccionales, pero no tiene idempotencia propia y la UI confunde mínimo con cantidad disponible.
- Backups, TLS DB, secret manager, alertas e infraestructura real están documentados parcialmente y no aprovisionados; no anunciarlos como implementados.

## Low / operativos

- Admin local no fue aprovisionado: la contraseña configurada no cumple 12 caracteres. No revelar valores; recuperar con contraseña fuerte y bootstrap explícito.
- `npm start` no migra ni compila y puede reutilizar artifacts de otra compilación; puerto ocupado causa conflicto. Crear runner con identificación de proceso del mismo proyecto y arranque completo.
- UI contiene colores claros y verdes dispersos, tamaños 8–12px, logo reconstruido y avatar redundante.

## Controles existentes conservados

Consultas parametrizadas, tenant desde sesión/membresía/workspace, RBAC server-side, aislamiento por IDs compuestos, token de reset/email de un uso, rate limiting persistente, CSP con nonce, validación de origen, transacciones de stock/venta/caja, idempotencia de pagos y webhook firmado, conservación del último OWNER. Suite aislada con DB temporal y proveedor de pago simulado.

Este es el diagnóstico inicial, no una certificación. El reporte de entrega indicará controles implementados y riesgos residuales sin secretos reales.
