# Documentos y aceptación

`legal_documents` identifica terms/privacy. `legal_document_versions` almacena texto, versión, estado de revisión y versión vigente única. `legal_acceptances` vincula versión, usuario, solicitud, empresa y fecha de aceptación. Al aprobar, las aceptaciones se asocian al workspace.

La entrega incluye `2026-09-draft-1`, marcada `LEGAL_REVIEW_REQUIRED`, publicada como borrador en `/terms` y `/privacy`. No se afirma cumplimiento jurídico definitivo. Completar identidad del prestador, contacto, proveedores, territorios de almacenamiento, plazos de retención y condiciones comerciales con asesoría jurídica antes del lanzamiento.

Publicar cambios mediante una nueva migración: insertar versión nueva, desactivar la anterior y activar la nueva dentro de una transacción; nunca sobrescribir una versión aceptada. Enviar y aprobar solicitudes exige todas las versiones vigentes. El flujo de reaceptación forzada para empresas ya activas queda pendiente.

No se recopilan IP ni user-agent para aceptación por defecto. No hay analítica/marketing ni trackers opcionales; solo cookies necesarias, por lo que no se agregó un banner ficticio. Si se agregan proveedores opcionales deberán bloquearse hasta consentimiento cuando corresponda.

Exportación CSV operativa por permisos y cuota. Cierre de organización, exportación integral y eliminación con retención/confirmación son procesos pendientes: no existe borrado masivo automático.
