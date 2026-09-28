# Validación

Comandos: `npm run migrate`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:all`. `npm ci` instala las dependencias fijadas en el lockfile.

`test:all` exige build previo, PostgreSQL local con permiso CREATE DATABASE y Edge para Playwright. Crea una base `nubra_test_<uuid>`, aplica todas las migraciones dos veces, aprovisiona credenciales aleatorias, levanta Next en puerto 3100 y SMTP local sin entrega externa. Ejecuta foundation, integration, browser y operations, luego detiene servicios y elimina únicamente su base generada. No apunta las pruebas al contenido empresarial configurado en .env. No ejecutar los antiguos scripts individuales sobre producción.

`npm run test:foundation` ejecuta el mismo entorno aislado para la nueva foundation. Incluye correo real contra SMTP local, tokens de un solo uso, registro/formulario/aceptación/aprobación en navegador móvil, protección de cuentas pendientes, aislamiento read/update/delete/export, autorización de personal, rol Cashier sin gestión de permisos, límites de Free, cambio de plan, consumo de exportación, suspensión/revocación, aprobación y ventas concurrentes, cancelación sin doble restitución, auditoría y aceptación versionada.

Las pruebas previas verifican stock bajo concurrencia, rollback, presupuestos, CRM, caja, cobros parciales, recuperación, OCR real en navegador y UI de administración/equipo. No se sustituye PostgreSQL por mocks. TypeScript strict y lint complementan, no reemplazan, estos ensayos.

Hay tres pruebas unitarias del serializador CSV (inyección de fórmulas, caracteres especiales y orden de columnas), ejecutadas con Node 24 como en este entorno. Pendiente: ampliar reglas unitarias, carga sostenida, fallas de red/SMTP, múltiples procesos, MFA y restauración de backups ensayada en infraestructura real.

## Ampliación: roles, invitaciones y pagos

`roles-billing.mjs` se ejecuta dentro del mismo entorno aislado y prueba aislamiento de roles, permisos efectivos y actualización en sesiones activas, invitaciones SMTP de un solo uso, importes del servidor, idempotencia de checkout, validación de vendedor/ambiente/firma, acreditación, devoluciones e historial aislado. `mp-fetch.mjs` se carga solo en el servidor de pruebas: redirige la API del proveedor a una fixture HTTP local, sin llamadas ni cobros reales. Playwright verifica administración, roles, planes, suscripción y ausencia de desbordes móviles/errores de archivos CSS y JS.

Desarrollo usa `.next-dev`, producción `.next`: compilar producción no reemplaza los chunks que usa el servidor de desarrollo. Los artefactos visuales de la suite quedan en `.next/test-*.png`.

## Comercio y seguridad

La suite también ejecuta `commerce.mjs`, `security.mjs` y `visual.mjs`. Comercio comprueba proveedores, vínculos entre empresas rechazados, POS con cobro parcial, rollback si no hay caja o stock, idempotencia, cuentas corrientes FIFO, sobrepago, costo histórico, reportes aislados, cuotas mensuales y avisos/confirmaciones en navegador. Roles/pagos comprueba además conciliación desde el retorno y rechazo de pedidos ajenos/estados enviados por cliente.

Seguridad valida sesiones, archivos privados, soporte autorizado, rol SQL y RLS. Visual ejecuta seis anchos entre 360 y 1440 px. Las capturas actuales se guardan en `.local/qa/`, excluido del repositorio. Las pruebas del proveedor simulan HTTP local; la homologación con cuentas reales de Mercado Pago sigue siendo un paso de despliegue.
