# Aislamiento de empresas

La identidad de cuenta (`getAccountSession`) permite únicamente completar y consultar la solicitud propia. El contexto empresarial (`getUserSession`) requiere sesión no vencida, membresía en el workspace de la sesión, organización activa y aprobada y verificación del usuario público. Una cuenta pendiente no recibe membresía.

No se reciben organizationId autorizantes desde JSON. El cambio de workspace comprueba membresía en SQL. Cada consulta CRUD, detalle, búsqueda, exportación y agregado filtra `organization_id` del contexto servidor. Las referencias de clientes, productos, ventas, presupuestos y pagos usan claves compuestas para impedir relaciones cruzadas.

Los endpoints internos aceptan IDs de empresas solo después de comprobar una identidad `staff_users` y su capacidad interna. Una cookie de personal no sirve para APIs de clientes. Los roles internos no equivalen a OWNER de una empresa.

Pruebas: cuenta sin aprobación bloqueada; A no puede leer/actualizar/borrar registros B; CSV A excluye B; relaciones cruzadas rechazadas; cambio de workspace validado; suspensión invalida sesiones. PostgreSQL RLS está habilitado y forzado en las tablas empresariales listadas en RLS.md. Cada transacción vincula contexto con SET LOCAL, sin estado compartido entre peticiones. La política verifica membresía además del identificador de empresa. El runtime usa un rol sin propiedad de tablas ni BYPASSRLS. Las tablas del plano de control usan autorización de aplicación; excepciones y límites frente a administradores de infraestructura en RLS.md.
