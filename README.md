# Nubra Negocios

Plataforma SaaS B2B modular. Next.js 16 / React 19 / TypeScript strict / PostgreSQL con SQL parametrizado. Esta entrega incorpora la foundation comercial sobre los módulos operativos existentes; no es todavía la totalidad del roadmap ni una certificación de producción.

## Inicio local

1. Instalar con npm ci en una instalación limpia.
2. Configurar .env desde .env.example con PostgreSQL local y credenciales propias.
3. Ejecutar npm run migrate. El servidor ya no crea tablas durante peticiones.
4. Configurar ADMIN_USERNAME y ADMIN_PASSWORD (mínimo 12 caracteres); ejecutar npm run setup:admin. El script conserva cuentas existentes.
5. Configurar SMTP y MAIL_ENABLED=true para registro/verificación y recuperación.
6. Ejecutar npm start: aplica migraciones, verifica administrador, prepara OCR, compila todas las rutas y abre el servidor. Reiniciar cierra el servidor anterior de este proyecto; si el puerto pertenece a otra aplicación, usa el siguiente libre. Para editar con recarga rápida, usar npm run dev.

Rutas: / inicio, /register-business solicitud, /plans planes, /admin administración heredada, /internal solicitudes/suscripciones/soporte y /settings/security sesiones y privacidad. El logo oficial y los tokens oscuros se comparten en web y módulos.

En esta instalación local se separó el login SQL del runtime del de migraciones. En nuevas instalaciones, provisionar los roles según RLS.md. node scripts/provision-runtime.mjs puede hacerlo en PostgreSQL local. No usar un superusuario como runtime.

El registro no concede acceso al workspace. Se requiere email verificado, formulario empresarial, aceptación de las versiones legales y aprobación NUBRA. La empresa aprobada comienza con Free. El origen y plan se pueden modificar desde el panel interno según permisos.

Se recuperó el administrador local con npm run setup:admin -- --generate-local. Sus credenciales están en .local/admin-access.txt, ignorado por Git. El comando ordinario conserva la contraseña existente; --reset permite rotarla con el valor seguro configurado. Sin SMTP, el registro responde 503; no se inventan correos enviados ni se exponen tokens de desarrollo.

## Funciones reales

- Registro, verificación de un solo uso, recuperación, sesiones revocables y solicitudes con estados.
- Panel interno separado; identidad de personal, revisión, aprobación idempotente, rechazo, información, suspensión y bloqueo.
- Cuatro planes, límites configurables, fuentes comerciales, historial, uso, solicitud de upgrade y aceptación legal versionada.
- Dashboard con métricas PostgreSQL; clientes/seguimiento, productos/stock, ventas/pagos, caja y presupuestos.
- Ventas directas con idempotencia y cancelación de ventas no cobradas; auditoría e historial de stock.
- Venta rápida con cobro completo/parcial, proveedores, costo/categoría/unidad/proveedor de productos, cuenta corriente y cobros distribuidos entre ventas.
- Reportes por período, productos y margen bruto estimado, historial de actividad y notificaciones dentro de la web.
- Free sin vencimiento con límites de uso; activación automática tras verificar pagos de Mercado Pago y actualización al volver del checkout.
- CSV por API con permisos, aislamiento, protección de fórmulas y cuota mensual.
- Layout responsive, búsqueda Ctrl/Cmd+K, política de privacidad y términos como borradores.

Nubra Base no se ofrece públicamente ni como parte de los planes. Mercado Pago Argentina está integrado para pagos mensuales o anuales, con activación automática al acreditar y sin débito recurrente. Precios independientes configurables en /internal; cobros deshabilitados hasta configurar cuenta, webhook, URL pública y precios. No hay IA, automatizaciones, depósitos múltiples ni emisión fiscal productiva activados.

Para Cloud Hosting administrado de Hostinger, usar la [guía de hPanel](docs/deployment/HOSTINGER_HPANEL.md), `npm run build:hostinger` y `npm run start:hostinger`. PostgreSQL es externo; el runtime no recibe credenciales de migración. La plantilla está en `deploy/hostinger/runtime.env.example`.

Para una **VPS**, usar la [guía de VPS](docs/deployment/HOSTINGER_VPS.md) y las
plantillas de `deploy/vps/`: Node.js 24, PostgreSQL local, servicio systemd y HTTPS.
El dominio se conecta a la IP de la VPS; no hace falta un plan Cloud.

## Verificación

npm run lint
npm run typecheck
npm run build
npm run test:all

La suite crea una base PostgreSQL local temporal y SMTP local, prueba migraciones desde cero y su replay, API y navegador Edge, y elimina solo su base generada. Requiere puerto 3100 libre y permiso local CREATE DATABASE. No usa datos empresariales existentes.

La documentación está organizada en [docs](docs/README.md): arquitectura, despliegue, integraciones, operación, seguridad, pruebas y decisiones. Consultá el [estado actual](docs/project-status.md), la [comparación funcional](docs/product/REFERENCE_COMPARISON.md) y las [características que se pueden agregar](docs/product/FEATURE_IDEAS.md).
