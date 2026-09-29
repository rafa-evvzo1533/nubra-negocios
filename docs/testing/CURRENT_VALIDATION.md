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

No se verificó todavía un despliegue real en hPanel, PostgreSQL externo o una cuenta real de Mercado Pago. Estos pasos dependen de la configuración del propietario y están detallados en [Hostinger](../deployment/HOSTINGER_HPANEL.md) y [suscripciones](../integrations/SUBSCRIPTIONS.md).
