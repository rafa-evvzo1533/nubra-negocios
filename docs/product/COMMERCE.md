# Operación comercial

Las funciones se incorporaron al workspace existente, con sus estilos y navegación. Cada consulta usa la sesión del negocio, permisos del rol y aislamiento SQL.

## Venta rápida

Buscá productos por nombre o SKU, indicá cantidades, cliente y medio de pago. Podés cobrar el total, una parte o dejar todo en cuenta corriente. Un saldo pendiente requiere cliente. El servidor usa precios vigentes, valida stock y guarda venta, movimientos, cuota mensual y cobro dentro de una transacción: si falla algo, no se guarda ninguna de esas operaciones. Efectivo exige una caja abierta desde Pagos y caja.

Reintentos con la misma clave y contenido devuelven el mismo resultado; cambiar los datos de una solicitud ya guardada produce conflicto. No es un modo offline ni una integración con terminales de tarjeta: el medio de pago registra un cobro realizado.

## Proveedores y catálogo

Alta y edición de nombre, email, teléfono, categoría y notas. Archivar conserva referencias históricas; los proveedores archivados también cuentan dentro de la capacidad contratada. Los productos incorporan costo unitario, categoría, unidad de venta y proveedor. Las cantidades continúan siendo unidades enteras, independientemente del nombre de unidad.

Cantidad disponible es stock real. Stock mínimo solamente define la alerta. Los ajustes de stock quedan auditados y requieren motivo al editar. Los costos se guardan en los renglones de cada venta nueva para que cambios posteriores del catálogo no alteren el margen histórico. Ventas anteriores a la migración tienen costo histórico cero; no debe interpretarse ese margen como ganancia contable real.

## Cuenta corriente

Saldo por cliente calculado desde ventas confirmadas menos cobros, sin una segunda tabla editable de deudas. El detalle muestra las ventas y lo pendiente. Un cobro se distribuye primero en las ventas más antiguas y nunca puede superar el saldo. Es una operación atómica e idempotente. No se genera una venta adicional para registrar un cobro.

## Reportes y actividad

Reportes por un rango de hasta 366 días, con cantidad e importe de ventas, cobros por medio, productos más vendidos y margen bruto estimado. Las fechas se interpretan en la zona horaria del negocio. No se incluyen gastos ni impuestos en el margen. Reportes requiere `reports.read` y `finance.read`.

El historial presenta los últimos 200 eventos del negocio con actor, fecha, acción y recurso; no muestra secretos ni contenido privado de cada registro. Proveedores y resumen de clientes muestran hasta 500 registros; el detalle de cuenta, hasta 200 ventas; el ranking, 25 productos. Estos límites de visualización no son capacidades comerciales.

## Notificaciones

Avisos dentro de la página, accesibles y descartables; los nuevos guardados y cobros muestran confirmación, y la aprobación de una suscripción actualiza el plan. Las confirmaciones de acciones sensibles utilizan diálogos de la web. Los banners existentes permanecen dentro de sus módulos. No se implementó todavía una bandeja persistente de notificaciones ni push del navegador.
