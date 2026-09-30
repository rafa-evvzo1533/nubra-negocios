# Validación de la entrega vigente

Fecha: 29/09/2026. Ejecutada localmente en Windows con Node 24, PostgreSQL y navegador Edge. Última migración: `0011_billing_periods_local_plans.sql`.

| Comprobación | Resultado |
| --- | --- |
| Lint | OK |
| TypeScript strict | OK |
| Build de producción e inicio integral | OK, aplicación disponible en localhost:3000 |
| Migraciones desde cero y segunda ejecución | OK, base temporal de la suite |
| Foundation y registro/aprobación | 90 comprobaciones |
| Roles, invitaciones, pago mensual/anual y navegación | 100 comprobaciones |
| Comercio: POS, cuentas, proveedores, costos, cuotas y aislamiento | 63 comprobaciones |
| Seguridad, RLS, sesiones, soporte y archivos | 65 comprobaciones |
| Integración, CRUD, concurrencia y rollback | 144 comprobaciones |
| Operaciones, caja, recuperación y OCR real en navegador | 63 comprobaciones |
| Responsive | 126 comprobaciones en seis anchos de 360 a 1440 px |
| Unitarias CSV y períodos de suscripción | 6 tests |
| Navegador | CRUD, venta múltiple, presupuestos, búsqueda, teclado, móvil y movimiento reducido OK |
| Inicio en modo Hostinger | Smoke local OK en puerto separado, salud y planes sin recompilar/migrar |

`npm run test:all` finalizó correctamente y eliminó su base temporal. Mercado Pago y SMTP se prueban contra servicios locales de fixture; no se hicieron cobros ni envíos externos. Node informa una advertencia de detección de módulos para tests que importan TypeScript; no afecta los resultados.

Los logs locales están en `.local/test-suite-monthly-annual.log`, `.local/start-monthly-annual.log`, `.local/hostinger-start-smoke.log`, `.local/lint-commerce.log` y `.local/typecheck-commerce.log`; no se publican. La corrida comercial anterior también pasó completa antes de incorporar la modalidad anual.

No se verificó hPanel, PostgreSQL externo o una cuenta real de Mercado Pago. La instalación elegida es una VPS independiente, documentada en [despliegue VPS](../deployment/VPS_DEPLOYED.md). Mercado Pago depende de la configuración del propietario, detallada en [suscripciones](../integrations/SUBSCRIPTIONS.md).

## Actualización: registro, VPS y limpieza (30/09/2026 UTC)

Se repitieron build, lint y la suite completa después de corregir el registro sin
SMTP, el origen HTTPS detrás de Nginx, los avisos al cerrar diálogos y el formato
de hora del dashboard. Todo pasó, incluidos ocho tests unitarios (los seis
anteriores más SMTP indisponible y proxy), OCR real y los mismos totales de la
tabla. Log: `.local/deploy/test-registration-cleanup.log`.

La VPS compiló correctamente con Node 24 y `npm ci`. La verificación SMTP real
pasó y el propietario confirmó la recepción del correo de registro. Esto es
adicional a los fixtures locales de la suite. Ver [registro y limpieza](REGISTRATION_DEPLOYMENT.md).
