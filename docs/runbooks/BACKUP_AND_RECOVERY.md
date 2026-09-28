# Copias y recuperación

Estado real: esta instalación no tiene backups automáticos, almacenamiento remoto ni restauración programada configurados por el código. No se promete RPO/RTO ni recuperación garantizada.

Antes de producción: asignar responsable, proveedor, regiones, retención y RPO/RTO medidos; copias cifradas de PostgreSQL en destino privado separado; claves de backup fuera del dump; acceso mínimo y MFA en infraestructura. Incluir objetos privados si se migra BYTEA a object storage, y el almacén de claves cuando se active cifrado de campos.

Ensayo: restaurar en una base aislada sin salida de correo/pagos, aplicar versión correspondiente del esquema, provisionar rol de runtime restringido, verificar políticas RLS/roles, conteos por negocio, referencias e integridad criptográfica. Revocar sesiones y enlaces restaurados antes de permitir acceso. Probar flujos con fixtures independientes y documentar duración real. No ensayar sobre la base operativa ni reemplazarla automáticamente.

Una eliminación lógica o borrado actual no elimina instantáneamente copias anteriores. Documentar su ciclo y el procedimiento para reaplicar eliminaciones tras restaurar. No destruir claves mientras existan copias autorizadas que dependan de ellas. Registrar restauración y quién la aprobó sin divulgar datos en logs.
