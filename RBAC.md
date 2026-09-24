# Roles y permisos

`roles`, `permissions` y `role_permissions` guardan la matriz de permisos. `requirePermission` vuelve a consultar la membresía vigente. El helper `can` permite adaptar controles de UI; la autorización final sigue en servidor. El nivel actual es `recurso.read/write`; separar create/update/delete/refund es deuda explícita antes de roles personalizados.

| Rol | Acceso |
| --- | --- |
| OWNER / ADMINISTRATOR / ADMIN | Core y equipo; solo OWNER administra propietarios |
| MANAGER | Core y caja, sin administrar equipo |
| SALES | Clientes, ventas, presupuestos; lectura comercial |
| CASHIER | Ventas y caja; consulta clientes/productos; sin permisos de equipo |
| OPERATIONS / INVENTORY | Productos y stock |
| FINANCE | Caja, consulta ventas/presupuestos |
| SUPPORT | Lectura de clientes |
| VIEWER | Lectura del core; sin administración de equipo |
| CUSTOM | Sin permisos por defecto; editor de roles pendiente |

Las cancelaciones están reservadas a propietarios, administradores y managers. Las exportaciones requieren además rol habilitado y cuota. El último propietario no puede ser eliminado. Cambiar un rol o quitar una membresía revoca sus sesiones del workspace. Las altas administrativas respetan el límite `users`; la invitación autoservicio por email es trabajo pendiente.

El panel NUBRA usa roles diferentes: SUPER_ADMIN, OPERATIONS_ADMIN, SALES_ADMIN, SUPPORT_ADMIN, BILLING_ADMIN, REVIEWER y READ_ONLY. Revisar solicitudes no concede acceso a clientes ni ventas. Las rutas administrativas heredadas están reservadas a SUPER_ADMIN y registran acceso privilegiado.

## Roles propios e invitaciones

El propietario crea, edita y elimina roles desde Equipo y roles. Los permisos de lectura/escritura son independientes por módulo; escribir requiere lectura. Cada rol pertenece a un solo negocio, con referencias compuestas en base de datos. Las APIs verifican permisos efectivos en cada petición. Un rol propio no puede modificar membresías, propietarios, roles ni contratar planes. No se puede eliminar un rol asignado o referenciado por invitaciones.

El propietario invita por correo, eligiendo un rol fijo o propio. Enlace con token aleatorio almacenado como hash, válido 7 días, de un solo uso, revocable y reservado para una cuenta con el mismo email verificado. Se comprueba capacidad del plan al invitar y aceptar. El rol propietario no se concede mediante invitaciones. SMTP es obligatorio; si falla la entrega la invitación se revoca y se informa el error.
