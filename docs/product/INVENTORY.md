# Inventario inicial

El catálogo usa SKU único por organización, precio en centavos, stock y stock mínimo. Un movimiento modifica el stock y guarda cantidad modificada, anterior, nueva, actor y motivo en la misma transacción. Movimientos históricos anteriores a este bloque no tienen retrospectivamente esos campos; se mantienen nulos, sin inventar valores.

Las ventas bloquean productos en orden estable, impiden sobreventa, guardan líneas/precios y movimientos. La venta directa exige idempotencyKey UUID; repetir la misma solicitud retorna la misma venta, reutilizar la clave con otros datos devuelve 409. Cancelar una venta sin pagos restituye stock y registra movimiento una sola vez. Ventas cobradas requieren un flujo de devolución aún pendiente.

Este bloque mantiene un único saldo por producto. Warehouse, InventoryItem por depósito, ProductVariant, unidades fraccionarias, transferencias y compras recibidas son el siguiente desarrollo del dominio. No hay endpoints falsos de transferencias ni se declara inventario avanzado disponible.
