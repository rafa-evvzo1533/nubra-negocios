# Administración NUBRA

Entrada principal `/internal`. `/admin` conserva gestión de metadata y consulta de membresías, restringida a SUPER_ADMIN; las altas/cambios/bajas de miembros se realizan desde el negocio. Aprovisionar la primera cuenta con `npm run setup:admin`, variables ADMIN_USERNAME y ADMIN_PASSWORD de al menos 12 caracteres. El script no cambia contraseñas de cuentas existentes; almacena Argon2id, nunca texto plano. La autenticación consulta staff_users, no compara secretos de entorno en cada petición. Deshabilitar staff revoca su autorización efectiva inmediatamente.

| Capacidad | Roles internos |
| --- | --- |
| Leer solicitudes, empresas y planes | Todos los roles internos activos |
| Revisar, aprobar, rechazar, pedir información | SUPER_ADMIN, OPERATIONS_ADMIN, REVIEWER |
| Cambiar/conceder/revocar plan, configurar límites | SUPER_ADMIN, BILLING_ADMIN, SALES_ADMIN |
| Suspender/reactivar/bloquear; auditoría interna | SUPER_ADMIN, OPERATIONS_ADMIN |
| Reactivar una empresa bloqueada; gestión de accesos heredada | SUPER_ADMIN |

La aprobación bloquea la solicitud, verifica email y aceptación legal vigente, crea Organization + OWNER + Free + historial + auditoría en una transacción. Reintentos concurrentes retornan la misma organización. Las transiciones ilegales reciben 409. Pedir información habilita edición y reenvío por el solicitante. El formulario exige motivo para rechazo, información, plan y suspensión.

El panel consulta metadatos de las empresas y consumo de usuarios; no ofrece acceso al contenido CRM, stock o ventas. Las rutas heredadas permiten acceso excepcional a miembros y auditoría de acciones, con trazabilidad de staff. Listados limitados a las últimas 200 solicitudes/empresas; filtros y paginación administrativa quedan pendientes. El estado de una solicitud se consulta en la web; aún no se envía un correo adicional de aprobación.

Soporte autorizado disponible en /internal; el propietario aprueba desde /settings/security. Ver SUPPORT_ACCESS.md. La recuperación local guarda credenciales únicamente en .local/admin-access.txt.
