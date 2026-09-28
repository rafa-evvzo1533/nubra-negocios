# Soporte autorizado

SUPER_ADMIN, SUPPORT_ADMIN y SECURITY_ADMIN pueden solicitar acceso en `/internal`. Indican negocio, motivo de al menos 15 caracteres, recursos y duración de 15/30/60/240 minutos. Solicitar no habilita lectura.

Solo OWNER del negocio puede aprobar, rechazar o revocar desde `/settings/security`. El grant queda asociado al miembro de staff solicitante y al propietario que decidió. Una cookie administrativa por sí sola no abre APIs empresariales. Se deshabilitaron altas y modificaciones de membresías desde las rutas administrativas heredadas; el equipo se invita y gestiona dentro del negocio.

| Alcance        | Campos disponibles                      |
| -------------- | --------------------------------------- |
| customers.read | ID, nombre, estado, fecha               |
| inventory.read | ID, nombre, SKU, cantidad, stock mínimo |
| sales.read     | ID, estado, origen, fecha               |

No se entregan email, teléfono, notas, importes, caja ni archivos. No hay escritura de soporte. Cada consulta vuelve a validar grant y políticas RLS; la interfaz no es la barrera de autorización.

Eventos: REQUESTED, APPROVED, REJECTED, STARTED, RESOURCE_ACCESSED, DENIED, REVOKED, EXPIRED. El vencimiento se aplica por fecha directamente en la autorización y SQL; el evento EXPIRED se registra de forma idempotente al consultar el listado o intentar un acceso, no mediante un cron inexistente. Historial visible para el propietario con personal, fecha y recurso. Revocar afecta las peticiones posteriores; no puede retirar información ya entregada.

Break-glass está inhabilitado: hay un modelo con único estado DISABLED y no hay API que lo active. Requiere otro bloque con doble aprobación, motivo de incidente, límites, notificación, expiración y auditoría externa antes de habilitarse.
