# Estado del proyecto

Actualizado: 2026-09-28. Este documento describe la entrega vigente; `archive/` conserva informes anteriores.

## Implementado

- Funciones revisadas contra `nubra-comercio-main`, manteniendo el diseño de Nubra Negocios: venta rápida, proveedores, campos de catálogo, cuenta corriente, reportes y actividad.
- POS transaccional: venta, stock, consumo y pago completo/parcial; rollback e idempotencia. Cobros de cuenta corriente distribuidos entre ventas pendientes, sin sobrepago.
- Costos históricos en ventas nuevas y reportes por período con margen estimado.
- Plan Free sin vencimiento: 1 usuario, 50 clientes, 100 productos, 10 proveedores, 100 ventas/mes y 2 exportaciones/mes. Capacidades configurables, igual que los otros planes; no se eliminan datos al alcanzar límites.
- Mercado Pago Argentina: Checkout Pro, verificación de pago y activación automática por webhook; conciliación autenticada al volver del checkout, actualización del plan y notificación web. Precios configurables, sin valores comerciales inventados.
- Notificaciones y confirmaciones dentro de la web, conservando avisos de cada módulo.
- Documentación organizada en arquitectura, ADR, despliegue, integraciones, operación, seguridad, pruebas, producto, legal e historial.

También se conserva el trabajo previo solicitado: logo oficial, inicio y administración, corrección de stock disponible, roles propios e invitaciones, inicio integral mediante `npm start`, sesiones y soporte autorizados, archivos privados y RLS empresarial.

## Configuración externa pendiente

Los cobros públicos necesitan credenciales, vendedor, webhook, URL pública HTTPS y precios; ver [configuración](integrations/SUBSCRIPTIONS.md). La integración cobra períodos de 30 días y los activa automáticamente al acreditar; **no realiza débito recurrente**. El correo necesita SMTP.

Persisten pendientes de la entrega de seguridad: MFA, proveedor de claves y migración del cifrado de campos existentes, backups administrados y restauración ensayada. El servicio de cifrado existe, pero no se presenta como si los datos históricos ya estuvieran cifrados. Los documentos legales conservan su revisión pendiente.

## Validación

La suite aislada cubre registro/aprobación, permisos, pagos simulados, comercio, concurrencia, stock, finanzas, seguridad/RLS, OCR y navegación responsive. Los resultados ejecutados de esta entrega se registran en [validación](testing/CURRENT_VALIDATION.md).

## Próximas funciones

Consultar la [lista de propuestas](product/FEATURE_IDEAS.md) y la [comparación con la referencia](product/REFERENCE_COMPARISON.md). Compras/recepciones, devoluciones, importación validada, códigos de barras, sucursales y notificaciones persistentes no se presentan como implementados.
