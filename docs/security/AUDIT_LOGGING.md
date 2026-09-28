# Auditoría y logs

Operaciones empresariales usan `audit_logs`; decisiones de plataforma, autenticación, sesiones y soporte usan `platform_audit_logs`. Las mutaciones principales insertan el evento en la misma transacción. Stock registra actor, motivo, cantidad anterior/nueva; soporte registra actor, organización, grant, recurso y cantidad de filas, nunca su contenido.

`nubra_runtime` no puede UPDATE/DELETE/TRUNCATE las tablas de auditoría. El administrador SQL todavía puede modificarlas: no son WORM ni un registro externo inmutable. Para producción falta exportación a almacenamiento independiente con retención/alertas y controles de acceso propios.

`sanitizeLogPayload` redacciona campos de contraseña, tokens, cookies, autorizaciones, hashes, claves, notas privadas, datos de contacto, imágenes y cuerpos. Limita profundidad, tamaño de arrays y strings; elimina emails y Bearer de mensajes. `securityLog` estructura fecha, evento y payload. No pasar registros comerciales completos aunque el sanitizador exista.

Fallos de login no registran contraseña, email ni token. Los errores de API no muestran SQL ni stack al cliente. Los IDs técnicos permiten correlación; deben tratarse como información restringida. No loguear query strings de enlaces privados en proxy/CDN/APM; configurar esa redacción también fuera de Next.

Retención sugerida para definir con operación y revisión jurídica: 90 días de logs técnicos; auditorías según necesidad contractual y obligaciones aplicables. No se programó eliminación automática sin una política aprobada. Acceso a auditorías empresariales bajo RLS; el panel interno obtiene solo eventos de plataforma.
