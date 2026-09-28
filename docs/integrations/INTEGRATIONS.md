# Integraciones

Las integraciones se implementan como conectores opcionales. Una conexion pertenece a una organizacion y tiene ciclo de vida independiente del nucleo.

## Contratos

- `IntegrationProvider`: capacidades y metadatos del conector.
- `IntegrationConnection`: credenciales referenciadas, estado y cuenta externa.
- `IntegrationSync`: cursor, direccion, errores y ultima ejecucion.
- `WebhookEvent`: payload firmado e idempotency key.
- `WebhookDelivery`: intentos, respuesta y proxima reintento.

Tienda Nubra puede sincronizar productos, stock, pedidos y clientes, pero Nubra Negocios funciona sin ella. Nubra Base consume API y deep links; no se incluye su codigo. La indisponibilidad de un conector no debe bloquear operaciones locales.

La administracion de empresa sigue perteneciendo a Nubra Negocios. NubraBase podra consultar capacidades como miembros, roles, plan, conexiones y auditoria mediante endpoints autenticados versionados, por ejemplo `GET /api/v1/organization`, `GET /api/v1/members` y `GET /api/v1/audit-log`. No se debe duplicar la autoridad de permisos en NubraBase.