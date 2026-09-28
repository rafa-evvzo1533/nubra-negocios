# Seguridad y límites

Controles activos: TypeScript/Zod, SQL parametrizado, contexto por petición, RBAC en servidor, RLS empresarial, Argon2id, sesiones revocables, cookies HttpOnly/SameSite y Secure en producción, CSP nonce, comprobación de origen, límites por identidad/acción, auditoría transaccional y redacción de logs.

El runtime usa nubra_runtime, sin DDL ni bypass de RLS. El login SQL local está separado del propietario usado para migrar. npm start omite credenciales de migración/bootstrap en el entorno del servidor. El plano de control no tiene aislamiento RLS universal: ver RLS.md.

El personal no obtiene una membresía ni lee contenido empresarial por ser administrador. Se bloquearon mutaciones administrativas heredadas del equipo. Soporte requiere grant solicitado por personal, aprobado por OWNER, acotado a recursos y tiempo; hay revocación y trazabilidad. El aprovisionamiento heredado de un negocio nuevo todavía permite definir una contraseña inicial del propietario: preferir registro público verificado. No permite agregar personal a un negocio existente.

En /settings/security se consultan y revocan sesiones y accesos de soporte. Los comprobantes son privados; los enlaces temporales requieren además la sesión del usuario creador. Revocar una sesión no borra información ya descargada. SALES ya no dispone de caja/finanzas; exportar e indicadores de ventas tienen permisos explícitos.

El servicio AES-256-GCM, el repositorio de claves envueltas y el adaptador Vault están implementados, pero los campos comerciales existentes no se han cifrado. No hay KMS/Vault configurado, MFA de personal, acceso de emergencia activo, backups programados ni sink externo inmutable. Ver ENCRYPTION.md, KEY_MANAGEMENT.md y BACKUP_AND_RECOVERY.md antes de activar esa fase.

Antes de producción: HTTPS/secret manager, SMTP, cuenta Mercado Pago y precios; MFA/recuperación de staff; rate limit por IP confiable y límite de payload global en ingress; monitoreo, alertas, retención, backups y restauración; completar identidad legal/contactos/proveedores. Los textos legales siguen como LEGAL_REVIEW_REQUIRED. No se afirma seguridad absoluta, conocimiento cero ni certificación de cumplimiento.

Las pruebas se ejecutan sobre bases locales efímeras. Comandos: npm run lint, npm run typecheck, npm run build, npm run test:all. Alcance y resultados en IMPLEMENTATION_REPORT.md.
