# API comercial adicional

Todos los endpoints de `/api/v1/commerce` exigen sesión de un negocio aprobado y permisos. Se conserva la defensa de origen del middleware para escrituras.

| Método y recurso | Permisos / comportamiento |
| --- | --- |
| GET `/suppliers` | `suppliers.read`; lista del negocio |
| POST `/suppliers` | `suppliers.write`; nombre, email, teléfono, categoría, notas |
| PUT `/suppliers?id=UUID` | Edita solo proveedor del negocio |
| DELETE `/suppliers?id=UUID` | Archiva; preserva referencias |
| POST `/pos` | `sales.write` y `cash.write` si hay cobro |
| GET `/accounts?customerId=UUID` | `accounts.read`; saldos y detalle opcional |
| POST `/accounts` | `accounts.write` + `cash.write`; distribuye cobro FIFO |
| GET `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | `reports.read` + `finance.read`; máximo 366 días |
| GET `/audit` | `audit.read`; últimos 200 eventos |

POS: `{idempotencyKey,customerId,items:[{productId,quantity}],paidCents,method}`. Cliente nullable solo si no queda saldo. Precios y stock se consultan en servidor. Cobro de cuenta: `{idempotencyKey,customerId,amountCents,method}`. Métodos: CASH, TRANSFER, CARD, OTHER. Importes en centavos enteros. POST devuelve 201; reintentos iguales devuelven la operación original, datos diferentes con la misma clave devuelven 409.

Productos admite `costCents`, `category`, `unit` y `supplierId` opcionales en la API existente; omitirlos conserva los datos en edición. `supplierId:null` desvincula el proveedor.

POST `/api/v1/billing/reconcile`: `{orderId,paymentId}`. Solo responsables del negocio dueño del pedido; limita frecuencia, consulta Mercado Pago y valida referencia, importe, moneda, vendedor y ambiente. No admite un estado indicado por cliente. La disponibilidad del plan se consulta en `/api/v1/subscription`.

POST `/api/v1/billing/checkout`: `{plan,period,idempotencyKey}`, con `period` MONTHLY o YEARLY (por defecto MONTHLY). El precio se obtiene del catálogo del servidor. PATCH `/api/internal/admin/prices` también acepta `period` y configura ese importe/habilitación de manera independiente. El historial devuelve `billing_period`; LEGACY_30_DAYS queda reservado a pedidos previos a la migración.
