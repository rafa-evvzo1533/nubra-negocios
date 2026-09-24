# Nubra Negocios

Plataforma SaaS B2B modular. Next.js 16 / React 19 / TypeScript strict / PostgreSQL con SQL parametrizado. Esta entrega incorpora la foundation comercial sobre los módulos operativos existentes; no es todavía la totalidad del roadmap ni una certificación de producción.

## Inicio local

1. Instalar con npm ci en una instalación limpia.
2. Configurar .env desde .env.example con PostgreSQL local y credenciales propias.
3. Ejecutar npm run migrate. El servidor ya no crea tablas durante peticiones.
4. Configurar ADMIN_USERNAME y ADMIN_PASSWORD (mínimo 12 caracteres); ejecutar npm run setup:admin. El script conserva cuentas existentes.
5. Configurar SMTP y MAIL_ENABLED=true para registro/verificación y recuperación.
6. Ejecutar npm run dev; visitar / para la web pública, /register para crear cuenta, /internal para revisión y suscripciones.

El registro no concede acceso al workspace. Se requiere email verificado, formulario empresarial, aceptación de las versiones legales y aprobación NUBRA. La empresa aprobada comienza con Free. El origen y plan se pueden modificar desde el panel interno según permisos.

La contraseña administrativa local recibida no cumple el mínimo del nuevo aprovisionamiento. No se cambió ni expuso; actualizarla antes de ejecutar setup:admin. Sin SMTP, el registro responde 503; no se inventan correos enviados ni se exponen tokens de desarrollo.

## Funciones reales

- Registro, verificación de un solo uso, recuperación, sesiones revocables y solicitudes con estados.
- Panel interno separado; identidad de personal, revisión, aprobación idempotente, rechazo, información, suspensión y bloqueo.
- Cuatro planes, límites configurables, fuentes comerciales, historial, uso, solicitud de upgrade y aceptación legal versionada.
- Dashboard con métricas PostgreSQL; clientes/seguimiento, productos/stock, ventas/pagos, caja y presupuestos.
- Ventas directas con idempotencia y cancelación de ventas no cobradas; auditoría e historial de stock.
- CSV por API con permisos, aislamiento, protección de fórmulas y cuota mensual.
- Layout responsive, búsqueda Ctrl/Cmd+K, política de privacidad y términos como borradores.

Nubra Base no se ofrece públicamente ni como parte de los planes. No hay cobros externos, AI, automatizaciones, depósitos múltiples ni emisión fiscal productiva activados.

## Verificación

npm run lint
npm run typecheck
npm run build
npm run test:all

La suite crea una base PostgreSQL local temporal y SMTP local, prueba migraciones desde cero y su replay, API y navegador Edge, y elimina solo su base generada. Requiere puerto 3100 libre y permiso local CREATE DATABASE. No usa datos empresariales existentes.

Ver REPOSITORY_AUDIT.md, ARCHITECTURE.md, DATABASE.md, SECURITY.md, TESTING.md, ROADMAP.md y DELIVERY.md.
