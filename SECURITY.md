# Seguridad y límites conocidos

## Controles implementados

- TypeScript strict, validación Zod y SQL parametrizado con nombres de tablas en listas cerradas.
- Scrypt con salt aleatorio; sesiones aleatorias de 256 bits cuyo hash es lo único persistido.
- Cookies HttpOnly, SameSite=Lax, Secure en producción y vigencia de ocho horas; revocación por logout, recuperación y suspensión.
- Cuenta pública pendiente separada del contexto de workspace; email verificado y aprobación requeridos.
- Tokens de verificación/recuperación de un solo uso y vencimiento; enlaces con token en fragmento que no llega al servidor ni al referrer.
- Rate limiting compartido en PostgreSQL por identidad/acción; respuestas de registro y recuperación no enumeran usuarios. La verificación de contraseña ejecuta KDF también para identidades inexistentes.
- Identidad interna persistida con rol y auditoría; sin comparación de contraseña administrativa de entorno durante login.
- Aislamiento por sesión/membresía/organization_id y claves compuestas. Cookie admin no habilita acceso a datos operativos.
- Origen y Sec-Fetch-Site comprobados en mutaciones, rechazo de tipos de contenido incompatibles; JSON acotado a 64 KiB en nuevos formularios/API de foundation. No hay CORS abierto.
- CSP con nonce por respuesta y renderizado dinámico, script strict-dynamic, bloqueo de objetos/framing, MIME nosniff, referrer no-referrer y Permissions-Policy. unsafe-eval solo en desarrollo; wasm-unsafe-eval para OCR local. Estilos inline siguen permitidos por la UI existente.
- HTTPS en producción, HSTS cuando se recibe HTTPS, SMTP TLS salvo servidor explícitamente local de pruebas.
- Auditoría transaccional de aprobación, suscripción, ventas, cancelación, exportación y cambios comerciales; errores sin SQL ni secretos.

## Autorización y concurrencia

Ver MULTI_TENANCY.md, RBAC.md y ADMIN_PANEL.md. Las consultas de negocio no confían en organizationId enviado por cliente. Cambios de plan se resuelven desde base sin cache obsoleta. Ventas/pagos/caja/stock usan transacciones; hay idempotencia y claves únicas. La suspensión elimina sesiones empresariales. Los permisos de una identidad interna se vuelven a consultar en cada petición.

Las rutas heredadas de gestión de accesos quedan reservadas a SUPER_ADMIN y registran acceso privilegiado. No se ofrece impersonación ni acceso general a contenido sensible desde el panel nuevo. Auditoría de miembros heredada conserva algunos eventos empresariales sin user_id; el acceso interno se registra por staff en plataforma.

## Antes de producción

MFA de personal y recuperación segura de staff; rotación/administración de sesiones; rate limiting adicional por IP fiable en ingress, protección de altas masivas y limpieza de rate_limits/tokens expirados; límites de payload globales en reverse proxy y endurecer rutas heredadas; rol SQL DML separado; cifrado de backups y ensayo de restauración; observabilidad, alertas y retención acordada. RLS no está habilitado. RBAC granular por acción y roles personalizados requieren un bloque propio.

SMTP puede fallar después de crear una cuenta; el usuario puede reintentar verificación desde su sesión y el error se registra sin token. Aún falta outbox duradero y reintentos de entrega. Las funciones futuras de archivos, API pública y webhooks no están expuestas: sus controles (S3 privado, MIME/antivirus, firma y rotación) se implementarán antes de activarlas.

Los documentos legales son borradores LEGAL_REVIEW_REQUIRED. La aplicación no se declara lista para comercializar hasta completar estas verificaciones, contratos y revisión jurídica. La contraseña administrativa local recibida no cumple el mínimo requerido por setup:admin; no se sobreescribe automáticamente.
