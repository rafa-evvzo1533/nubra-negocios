# NUBRA Negocios — rediseño y seguridad

Entrega incremental sobre Next.js 16.3.5, React 19, TypeScript y PostgreSQL. No se cambió de framework ni se agregó otra aplicación. Fecha de cierre: 28 de septiembre de 2026.

## Cambios visibles

- Diseño oscuro compartido: fondos #020307/#070912/#0B0E18, texto claro, azul/violeta/cyan, estados semánticos y fuente Inter alojada localmente. Tokens comunes en CSS y módulos existentes, formularios, tablas, diálogo y cabeceras.
- Página principal con presentación de módulos reales, registro de negocio, pasos, planes, FAQ y enlaces de privacidad. Planes y capacidades continúan viniendo del catálogo PostgreSQL.
- Logo oficial `src/assets/images/nubranegocios.png` en web, login, workspace, suscripción y administración. Se quitó la R redundante del encabezado; se conserva el perfil de la barra lateral.
- Productos distingue **Cantidad disponible** de **Stock mínimo (alerta)**. Se pueden ingresar unidades al crear/editar; los ajustes requieren motivo, generan movimiento auditado y comprueban el stock esperado para evitar sobrescribir cambios concurrentes. Inventario admite idempotencia.
- Registro de negocio accesible desde el inicio y el workspace. Los propietarios pueden crear roles, asignar permisos e invitar integrantes. La UI incluye permisos de exportación e indicadores de ventas.
- Seguridad y privacidad: gestión/revocación de sesiones, solicitudes de soporte, aprobación/rechazo/revocación e historial visible al propietario.
- Precios configurables y Mercado Pago Argentina conservados: pago por 30 días, sin débito recurrente. No se habilitaron cobros reales ni se fijaron precios de negocio.

## Inicio y administrador

`npm start` prepara migraciones, administrador y OCR; compila las rutas y sirve la aplicación. Identifica el proceso del mismo proyecto antes de detenerlo. Si el puerto pertenece a otra aplicación, busca el siguiente disponible. Coordina arranques simultáneos mediante un lock local. No borra datos ni mata todos los procesos Node del equipo.

El administrador original no se había aprovisionado: la contraseña configurada no cumplía el mínimo. Se recuperó con una contraseña aleatoria fuerte mediante `setup:admin -- --generate-local`; las credenciales están en `.local/admin-access.txt`, excluido de Git. `setup:admin` normal conserva la contraseña existente; `--reset` permite rotación explícita y revoca sesiones internas.

Rutas: `/` inicio, `/admin` administración, `/internal` solicitudes/planes/soporte, `/plans` beneficios y `/settings/security` seguridad. El puerto real aparece al finalizar `npm start`.

## Arquitectura y vulnerabilidades

| Hallazgo inicial                                      | Cambio                                                                                   | Riesgo residual                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Conexión web superusuario, sin RLS                    | Login runtime restringido, SET LOCAL por transacción y FORCE RLS empresarial             | Administrador de infraestructura/SQL sigue privilegiado                                                |
| Staff podía otorgar membresías en negocios existentes | POST/PATCH/DELETE heredados de miembros responden 403; propietario invita/gestiona       | Aprovisionamiento inicial heredado aún define contraseña del nuevo dueño; preferir registro verificado |
| Soporte sin autorización temporal                     | Solicitud, alcance, aprobación OWNER, expiración, revocación, lectura mínima y auditoría | Datos ya entregados no se pueden retirar; sin break-glass activo                                       |
| Sesiones sin pantalla de gestión                      | Lista y revocación individual/otras/todas                                                | MFA y notificaciones de seguridad pendientes                                                           |
| Scrypt y logs sin sanitizador común                   | Argon2id y migración al autenticar; redacción recursiva                                  | Auditoría externa/alertas pendientes                                                                   |
| Rol SALES podía leer caja                             | RBAC explícito de finanzas, exportación y métricas                                       | RLS separa empresas; los permisos por módulo se aplican en servidor                                    |
| URL privada sin vencimiento en UI                     | Enlaces HMAC de 5 min vinculados a usuario/negocio, auditoría de descargas               | Endpoint heredado sigue autenticado; proxy debe redactar query strings                                 |
| Confusión de mínimo/stock y reintento de ajuste       | Campos separados, control optimista, locks, movimiento e idempotencia                    | Clientes antiguos sin clave deben actualizarse                                                         |
| No había arquitectura de claves                       | Interfaces, AES-GCM, DEK envueltas y adaptador Vault                                     | Datos comerciales existentes aún plaintext; proveedor y migración pendientes                           |

## Migraciones y RLS

- `0007_security_boundaries.sql`: rol DML, sesiones, soporte, enlaces privados, claves, estado de emergencia deshabilitado, permisos, idempotencia de inventario y políticas RLS.
- `0008_support_history.sql`: inicio/registro de expiración e índices de soporte.
- `0009_privacy_revision.sql`: nueva versión legal en borrador, conservando versiones/aceptaciones anteriores.

RLS cubre datos operativos, comprobantes, caja/pagos, tablas fiscales, claves, enlaces y auditoría empresarial. El plano de control (auth, membresías, catálogo, solicitudes, grants, suscripciones) requiere autorización específica de aplicación; no se afirma cobertura universal. Ver [RLS.md](../security/RLS.md) y [MULTI_TENANCY.md](../architecture/MULTI_TENANCY.md).

## Cifrado y claves

Campos comerciales migrados a ciphertext en esta entrega: **ninguno**. No se modificaron datos existentes sin proveedor/recuperación configurados. Implementados `EncryptionService`, `KeyManagementProvider`, `VaultKeyManagementProvider` y `PostgresOrganizationKeyRepository`: AES-256-GCM, IV aleatorio, AAD por empresa/registro/campo/versión, DEK de 256 bits envuelta fuera de la base y versionado/rotación. Pruebas verifican integridad, separación de contexto y lectura tras rotación. No se promete conocimiento cero ni E2EE.

Siguiente fase documentada en [ENCRYPTION.md](../security/ENCRYPTION.md) y [KEY_MANAGEMENT.md](../security/KEY_MANAGEMENT.md): provisionar Vault/KMS, verificar recuperación y migrar campos por lotes con checkpoints antes de retirar plaintext. Referencias técnicas: [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) y [Vault Transit](https://developer.hashicorp.com/vault/api-docs/secret/transit).

## Roles, permisos y soporte

Roles internos separados de los de empresa; SECURITY_ADMIN incorporado al modelo. SUPER_ADMIN/SUPPORT_ADMIN/SECURITY_ADMIN pueden solicitar soporte. Solo OWNER decide. Grants de 15, 30, 60 o 240 minutos con alcance clientes básicos, inventario o estado de ventas; sin email/teléfono/notas/importes/caja/archivos ni escritura. Eventos REQUESTED/APPROVED/REJECTED/STARTED/RESOURCE_ACCESSED/DENIED/REVOKED/EXPIRED. La fecha se valida en cada acceso y en SQL, aunque no haya cron. Ver [SUPPORT_ACCESS.md](../security/SUPPORT_ACCESS.md).

La cookie interna no habilita `/api/v1/*`. Roles propios no pueden administrar propietarios ni concederse `members.write`. Los controles se aplican en servidor y no dependen de esconder botones.

## Archivos principales

Nuevos servicios: `request-context.ts`, `support-access.ts`, `session-management.ts`, `private-files.ts`, `logging.ts`, `security/encryption.ts`, `security/key-repository.ts`. Nuevas APIs en `api/auth/sessions`, `api/internal/support`, `api/v1/support-access` y `api/v1/files`.

Nuevos componentes: `ui/Brand`, `ui/PageHeader`, `foundation/SecurityView`, `SupportAccess`, `SupportHistory` y página `settings/security`. Modificados Workspace, PublicShell, Login, AdminView, InternalConsole, página de planes, SubscriptionView, LegalPage, TeamView, RolesManager, Composer, RecordDetail y CSS de los módulos existentes.

Infraestructura: `scripts/start.mjs`, `scripts/provision-runtime.mjs`, bootstrap/migrate, `package.json`, dependencias Argon2/Inter, `.gitignore`, `.env.example`. Pruebas nuevas `security.mjs`, `visual.mjs`, fixtures aislados y ajustes al runner/tests previos para no usar bypass administrativo como mecanismo de alta de empleados.

Documentación: auditorías previas UI/seguridad, RLS, ENCRYPTION, KEY_MANAGEMENT, SUPPORT_ACCESS, AUDIT_LOGGING, BACKUP_AND_RECOVERY, INCIDENT_RESPONSE, DATA_CLASSIFICATION, PRIVACY_ARCHITECTURE, THREAT_MODEL, SECURITY, MULTI_TENANCY y README.

## Validación

Las suites crean una base local `nubra_test_<uuid>`, SMTP y proveedor de pagos de prueba; migran dos veces y eliminan únicamente su propia base. No usan datos empresariales ni generan cobros reales. Comprueban registro/aprobación, roles/invitaciones, webhook falso/idempotencia, ventas concurrentes, stock, finanzas, CSV, archivos, sesiones, soporte y aislamiento RLS incluso con SQL sin WHERE.

Resultados ejecutados sobre la versión final:

| Comprobación | Resultado |
| --- | --- |
| npm run lint | OK, sin errores ni advertencias |
| npm run typecheck | OK |
| Compilación de producción mediante npm start | OK; todas las rutas compiladas |
| npm run test:all | OK, base aislada creada y eliminada |
| Foundation | 90 comprobaciones |
| Roles, invitaciones y Mercado Pago simulado | 81 comprobaciones |
| Seguridad | 65 comprobaciones |
| Integración | 144 comprobaciones |
| Operaciones, recuperación y OCR real en navegador | 63 comprobaciones |
| Responsive | 126 comprobaciones en 1440/1280/1024/768/390/360 px |
| CSV | 3 tests |
| Navegador | CRUD, venta múltiple, presupuesto, búsqueda, móvil, teclado y movimiento reducido OK |
| Administrador local | Credenciales reales verificadas por API y navegador; sesión de prueba cerrada |
| Reinicio | Proceso anterior detenido y nuevo servidor en localhost:3000 |
| Rol PostgreSQL local | SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/INHERIT deshabilitados |
| git diff --check | OK |

Se revisaron capturas de landing, administrador, planes, dashboard y formulario móvil. Capturas en .local/qa con datos sintéticos; los precios de prueba no se aplicaron al catálogo local. Logs de comprobación en .local/test-suite-final.log y .local/start-restart.log. Se conserva una advertencia de Node sobre detección de formato de módulo en el test CSV; los tests terminan con código 0. No hay cobros reales.

## Pendientes y límites de despliegue

- SMTP, credenciales de Mercado Pago/webhook, URL pública y precios deben configurarse para correo y cobros reales.
- Migración de campos sensibles y servicio externo de claves; MFA/recuperación del personal, notificaciones, alertas, backups cifrados con restauración ensayada y auditoría externa.
- Break-glass deshabilitado. No hay promesas de SSO, HA, recuperación automática ni funciones futuras incluidas en planes.
- Proveedores/compras, tareas/agenda, automatizaciones y otras áreas que no existían como módulos funcionales no se inventaron durante el rediseño; no hay IA añadida.
- Textos legales siguen como borradores; completar identidad, contacto, proveedores, ubicación, retención y revisión jurídica antes de comercializar.
