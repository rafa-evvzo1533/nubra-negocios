-- Preserve every previously accepted version. Only the current pointer changes.
CREATE TEMP TABLE previous_legal AS SELECT * FROM legal_document_versions WHERE current;
UPDATE legal_document_versions SET current=FALSE WHERE current;
INSERT INTO legal_document_versions(document_id,version,current,content)
SELECT v.document_id,'2026-09-draft-2',TRUE,v.content || CASE d.slug WHEN 'privacy' THEN $privacy$

Acceso técnico y soporte autorizado. El personal de plataforma administra solicitudes, estado del servicio y facturación. La consulta operativa de un negocio mediante soporte requiere autorización del propietario, motivo, alcance limitado y vencimiento. El propietario puede revocar el acceso y consultar su historial. El soporte disponible es de lectura y no incluye notas privadas, datos de contacto, importes de venta, caja o archivos. Las consultas quedan auditadas.

Controles implementados y límites. El aislamiento combina permisos de aplicación y políticas de filas de PostgreSQL para datos operativos. Las contraseñas nuevas se derivan con Argon2id y las anteriores se actualizan al ingresar. Las sesiones se pueden revocar. Los comprobantes permanecen privados; los enlaces temporales requieren además una sesión autorizada. Esta versión no aplica cifrado de campos a todo el contenido empresarial ni es un sistema de conocimiento cero. La administración de infraestructura, base de datos y copias de seguridad sigue siendo una función privilegiada que requiere controles organizativos. El cifrado de disco, copias y la gestión externa de claves deben configurarse en el despliegue.
$privacy$ ELSE $terms$

Pagos habilitados en esta versión. Los precios y capacidades vigentes provienen del catálogo del servicio. Cuando un precio está habilitado, se puede realizar un pago por Mercado Pago que concede un período de 30 días, confirmado por el proveedor. No existe renovación automática ni débito recurrente en esta versión. La solicitud de registro y la consulta de un plan no generan un cobro.

Soporte y autorizaciones. El propietario gestiona su equipo, roles y accesos temporales de soporte. La autorización de soporte indica el motivo, recursos y duración; puede ser revocada por el propietario. El acceso de emergencia no se encuentra habilitado.
$terms$ END FROM previous_legal v JOIN legal_documents d ON d.id=v.document_id;
DROP TABLE previous_legal;
