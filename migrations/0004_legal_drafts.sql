INSERT INTO legal_documents(slug,title) VALUES ('privacy','Política de privacidad'),('terms','Términos de uso');
INSERT INTO legal_document_versions(document_id,version,current,content) SELECT id,'2026-09-draft-1',TRUE,
CASE slug WHEN 'privacy' THEN $privacy$
Borrador para revisión jurídica. Esta política describe el tratamiento previsto para Nubra Negocios. La identidad jurídica del responsable, domicilio, contacto de privacidad, proveedores y plazos definitivos deben completarse antes de la apertura comercial.

Datos recopilados. Recopilamos datos de cuenta, contacto y autenticación; información que el responsable proporciona sobre su negocio; solicitudes de acceso; datos de clientes, productos y operaciones que cada empresa incorpora; registros de seguridad y uso. No se exige identificación fiscal cuando no corresponda al negocio.

Finalidades. Utilizamos estos datos para verificar el acceso, revisar solicitudes, prestar las funciones contratadas, administrar planes, atender consultas, prevenir abusos y mantener trazabilidad de operaciones. Las empresas deben contar con autorización o fundamento aplicable para incorporar información de terceros.

Cookies. La aplicación utiliza cookies necesarias para mantener sesiones. Esta versión no incorpora trackers de analítica ni publicidad. Si se agregan herramientas opcionales, deberán contar con controles de consentimiento antes de activarse cuando corresponda.

Seguridad y acceso. Aplicamos controles de acceso por empresa y rol, contraseñas derivadas criptográficamente y registros de auditoría. El personal interno accede según sus funciones. Ningún sistema puede garantizar la ausencia absoluta de incidentes.

Proveedores y almacenamiento. La infraestructura, correo y almacenamiento pueden requerir proveedores técnicos. Antes del lanzamiento, NUBRA debe informar cuáles intervienen, las ubicaciones de tratamiento y las condiciones aplicables a transferencias internacionales. No se prevé vender información empresarial para publicidad.

Retención y eliminación. Los datos se conservan durante la prestación y por los períodos justificados por obligaciones aplicables, seguridad o resolución de controversias. La política operativa debe fijar plazos por categoría, incluyendo copias de seguridad. El cierre de una cuenta requiere verificar la identidad y las solicitudes de conservación válidas.

Derechos y contacto. Podés solicitar acceso, corrección, exportación o eliminación según corresponda a través del canal de privacidad que NUBRA debe publicar antes del lanzamiento. Las solicitudes sobre datos ingresados por una empresa pueden requerir intervención de esa empresa.

Modificaciones. Publicaremos versiones fechadas. Los cambios sustanciales podrán requerir nueva aceptación. Este borrador no afirma cumplimiento definitivo de ninguna jurisdicción.
$privacy$ ELSE $terms$
Borrador para revisión jurídica. Antes del lanzamiento deben completarse la identidad y domicilio del prestador, contacto, jurisdicción, condiciones comerciales, política de retención y términos de responsabilidad aplicables.

Aceptación y servicio. Nubra Negocios es una plataforma de gestión empresarial. Crear una cuenta permite solicitar acceso; no implica aprobación ni contratación automática de un plan pago. El responsable debe revisar y aceptar las versiones vigentes de estos términos y de la política de privacidad.

Cuentas y obligaciones. Proporcioná información veraz, protegé tus credenciales y asigná accesos de acuerdo con las funciones de cada persona. No utilices el servicio para vulnerar derechos, eludir controles o introducir contenido malicioso. La empresa es responsable de la legitimidad de los datos y contenidos que incorpora.

Planes y pagos. Las funciones disponibles, capacidades, fuentes de suscripción y límites se muestran en la cuenta. Las funciones anunciadas como futuras no están incluidas como prestaciones disponibles. Los precios, impuestos, renovación, cancelación y reembolsos de planes pagos se establecerán en la propuesta comercial aceptada. No se realiza ningún cobro al enviar una solicitud de cambio de plan.

Suspensión. NUBRA puede revisar, solicitar información, rechazar o suspender accesos por motivos contractuales, seguridad o abuso. Deben definirse y comunicarse los canales de revisión y los plazos que correspondan. Suspender el acceso no equivale a eliminar de inmediato la información.

Contenido y propiedad intelectual. La empresa conserva sus derechos sobre el contenido que incorpora y permite su tratamiento en la medida necesaria para prestar el servicio. El software, marcas y materiales de NUBRA conservan su titularidad. No se otorgan derechos de reventa salvo acuerdo expreso.

Disponibilidad y limitaciones. Las condiciones de disponibilidad, soporte y recuperación dependen del servicio contratado. Los reportes son herramientas de gestión y no sustituyen asesoramiento profesional. Los comprobantes internos no se presentan como facturas fiscales autorizadas. Las limitaciones de responsabilidad deberán ser revisadas jurídicamente y no excluyen derechos irrenunciables.

Terminación y datos. El cierre debe solicitarse por un canal verificado. La exportación, retención y eliminación estarán sujetas a las condiciones publicadas y obligaciones aplicables. Las copias de seguridad siguen su ciclo documentado de retención.

Cambios y contacto. Las versiones se conservan con su fecha de aceptación. Los cambios relevantes podrán requerir nueva aceptación. NUBRA debe publicar el canal contractual de contacto antes del lanzamiento comercial. Este texto no representa una revisión jurídica final.
$terms$ END FROM legal_documents;
