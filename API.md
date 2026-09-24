# API implementada

Todas las rutas empresariales usan `nubra_user_session` HttpOnly. El workspace procede de la sesión persistida y se valida contra membresías. `organizationId` nunca se acepta como autoridad desde el navegador. Las respuestas privadas usan `Cache-Control: no-store`.

## Sesiones y administración

- `POST /api/admin/login`: acceso del personal Nubra.
- `GET/POST /api/admin/organizations`: listar empresas y crear empresa/usuario/OWNER.
- `POST /api/auth/login`, `POST /api/auth/logout`: acceso empresarial y revocación.
- `GET /api/auth/workspaces`: membresías del usuario.
- `POST /api/auth/workspaces`: `{workspaceId}` validado contra membresía.

## Recursos

| Ruta                               | Métodos          | Función                                                              |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------- |
| `/api/v1/dashboard/summary`        | GET              | Métricas, serie diaria de 14 días, stock bajo y actividad según RBAC |
| `/api/v1/customers`                | GET, POST        | Clientes                                                             |
| `/api/v1/customers/:id`            | GET, PUT, DELETE | Consulta, reemplazo y eliminación                                    |
| `/api/v1/customers/:id/activities` | GET, POST        | Historial y registro de contactos                                    |
| `/api/v1/products`                 | GET, POST        | Productos                                                            |
| `/api/v1/products/:id`             | GET, PUT, DELETE | Consulta, reemplazo y eliminación                                    |
| `/api/v1/inventory`                | GET, POST        | Movimientos de inventario                                            |
| `/api/v1/inventory/:id`            | GET              | Consultar movimiento                                                 |
| `/api/v1/sales`                    | GET, POST        | Ventas transaccionales                                               |
| `/api/v1/sales/:id`                | GET              | Cabecera y líneas                                                    |
| `/api/v1/quotes`                   | GET, POST        | Presupuestos                                                         |
| `/api/v1/quotes/:id`               | GET              | Cabecera y líneas con precios guardados                              |
| `/api/v1/quotes/:id/status`        | POST             | `{status}`: SENT, ACCEPTED o REJECTED                                |
| `/api/v1/quotes/:id/convert`       | POST             | Conversión transaccional e idempotente; devuelve `{id}` de venta     |

## Entradas

- Cliente: `{name, email?, phone?, notes?, status?, nextContact?}`. Estados LEAD/ACTIVE/INACTIVE; fecha YYYY-MM-DD o vacía.
- Actividad: `{kind, description}`. Tipos NOTE/CALL/MEETING/EMAIL; descripción hasta 5000 caracteres.
- Producto: `{name, sku, priceCents, minimumStock?}`. Stock inicial cero.
- Movimiento: `{productId, quantity, reason}`. Entero distinto de cero; negativo para salida.
- Venta: `{customerId?, items: [{productId, quantity}]}`. Hasta 100 líneas; precio vigente del servidor.
- Presupuesto: campos de venta más `{validUntil?, notes?}`. Guarda precio del catálogo y nombre de producto al crearse; no descuenta stock.

Zod estricto rechaza campos extras en cuerpos. PUT reemplaza todos los campos editables. POST de colecciones devuelve 201 y `{id}`; acciones de seguimiento/estado/conversión, PUT y DELETE devuelven 200.

Transiciones: DRAFT → SENT → ACCEPTED → CONVERTED. Se puede rechazar desde DRAFT, SENT o ACCEPTED. Un presupuesto vencido solo permite rechazo; convertido/rechazado son terminales. Conversión repetida devuelve la misma venta. El cliente o producto asociado no puede eliminarse mientras haya referencias.

## Búsqueda y paginación

GET de colecciones acepta `q` (hasta 120 caracteres), `page` (desde 1), `pageSize` (1–100), `paginated=1` y `filter`. Devuelve `{items,total,page,pageSize}`. Sin `paginated=1` conserva el array compatible de hasta 100 resultados; `pageSize` se aplica solo a la modalidad paginada.

Filtros por recurso:

- Clientes: all, LEAD, ACTIVE, INACTIVE, due (contacto pendiente según zona horaria de organización).
- Productos: all, low (stock <= mínimo).
- Inventario: all, in, out.
- Presupuestos: all, DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED.
- Ventas: all.

La búsqueda es literal y no distingue mayúsculas. Incluye nombres/email/teléfono para clientes, nombre/SKU para productos, producto/motivo para movimientos y referencia/cliente para documentos (también notas en presupuestos). Cada join incluye organization_id. Orden estable por fecha e ID. Historial de actividades limitado a los últimos 100 eventos.

Respuestas de registros usan snake_case; BIGINT de importes se serializa como string. Fechas de seguimiento/vencimiento en YYYY-MM-DD.

Errores: 400 validación, 401 sin sesión, 403 RBAC/origen, 404 recurso no disponible en organización, 409 stock/integridad/transición inválida. Ventas y movimientos no se editan ni eliminan; una venta sin cobros se puede cancelar mediante su acción auditada. Presupuestos no se editan después de crearse; solo cambian de estado.

Pedidos, webhooks y OAuth externo siguen pendientes. Pagos/caja y correo transaccional de verificación/recuperación están implementados.

## Foundation comercial

| Método y ruta | Autorización y comportamiento |
| --- | --- |
| POST /api/auth/register | Público con rate limit; name/email/password; respuesta genérica, SMTP requerido |
| POST /api/auth/verify-email | Token de un solo uso del fragmento del enlace |
| PUT /api/auth/verify-email | Sesión de cuenta; reenvío limitado |
| GET /api/v1/application | Sesión de cuenta; solicitud propia y versiones legales vigentes |
| POST /api/v1/application | Cuenta verificada; business, requestedPlan, submit, legalVersionIds; sin organizationId |
| GET /api/v1/subscription | Contexto empresarial; plan, capacidades, consumo y comparación |
| POST /api/v1/subscription | OWNER/ADMIN; guarda solicitud comercial de cambio, sin cobrar |
| POST /api/v1/exports/[resource] | Contexto empresarial + permiso + cuota; customers/products/sales/inventory; CSV de hasta 10.000 filas |
| POST /api/v1/sales/[id]/cancel | Rol autorizado; venta propia sin cobros; devolución de stock idempotente |
| GET /api/health | Estado mínimo de conexión y versión del esquema; sin secretos |

La venta directa POST /api/v1/sales ahora requiere `idempotencyKey` UUID junto con customerId opcional e items. Repetir la misma clave/cuerpo devuelve el mismo ID; reutilizarla con otro cuerpo devuelve 409. Clientes existentes deben conservar la clave durante reintentos. La conversión de presupuestos mantiene su idempotencia por quote.

## Administración interna nueva

| Método y ruta | Operación |
| --- | --- |
| GET /api/internal/admin/applications | Metadatos y solicitudes; máximo 200 |
| POST /api/internal/admin/applications/[id] | action approve/reject/information/review; message obligatorio salvo approve |
| GET /api/internal/admin/organizations | Empresas, fuente/plan y solicitud comercial pendiente; máximo 200 |
| POST /api/internal/admin/organizations/[id] | action status + status/reason; action plan + subscription; action revoke + reason |
| GET /api/internal/admin/plans | Catálogo y capacidades |
| PATCH /api/internal/admin/plans | plan, feature, enabled, limit, reason; modificación auditada |
| GET /api/internal/admin/audit | Últimos 200 eventos de plataforma; permiso operations |

`subscription` recibe plan, source, reason y expiresAt opcional. No permite mezclar Lite/Enterprise con el paquete incorrecto. Todas estas rutas requieren cookie de personal activo y autorización por capacidad; ver ADMIN_PANEL.md. `/api/admin` se conserva para accesos heredados de SUPER_ADMIN, no para administradores de empresas clientes.

Las nuevas rutas de formularios limitan JSON real a 64 KiB y rechazan campos extra mediante Zod. Errores adicionales: 413 tamaño, 429 rate limit y 503 correo no configurado. Los documentos legales se sirven desde páginas públicas, con contenido versionado en PostgreSQL.

## Roles, equipo y checkout

- `GET/POST /api/v1/roles`, `PUT/DELETE /api/v1/roles/:id`: propietario, rol aislado por negocio; `{name,description,permissions}`.
- `PATCH /api/v1/members/:id`: admite `{role:"CUSTOM",customRoleId}`; no acepta roles de otra empresa.
- `GET/POST /api/v1/invitations`: propietario; `{email,role,customRoleId?}`. `DELETE /api/v1/invitations/:id` revoca.
- `POST /api/auth/accept-invitation`: cuenta verificada, `{token}` del fragmento del enlace recibido por email.
- `PATCH /api/internal/admin/prices`: personal autorizado; `{plan,priceCents,currency:"ARS",enabled}`.
- `POST /api/v1/billing/checkout`: responsable del negocio; `{plan,idempotencyKey}`; devuelve `{id,url}`. Precio no controlable desde cliente.
- `GET /api/v1/billing/history`: pedidos del negocio actual.
- `POST /api/billing/mercadopago/webhook?data.id=...`: firma `x-signature`, `x-request-id`; verifica el pago consultando Mercado Pago.
