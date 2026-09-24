# Caja inicial

`cash_sessions` permite una caja abierta por organización, saldo inicial, saldo esperado al cierre, saldo contado y actores. `cash_movements` registra entradas/salidas; `payments` registra cobros parciales con CASH/TRANSFER/CARD/OTHER. Las operaciones usan bloqueo y transacciones; pagos y movimientos exigen clave de idempotencia.

Saldo esperado = saldo inicial + suma de movimientos. El cierre guarda el contado, esperado y la diferencia que presenta la UI. Cobrar en efectivo requiere caja abierta. Un cobro no puede superar el saldo de la venta. Una venta cancelada no admite nuevos cobros. El resultado de caja no se etiqueta como ganancia contable.

Pendiente: varias cajas/sucursales, categorías contables, Income/Expense separados, conciliación bancaria y devoluciones de pagos. El código actual está en `src/server/finance.ts`; no se crean funciones nominales que no tengan operación real.
