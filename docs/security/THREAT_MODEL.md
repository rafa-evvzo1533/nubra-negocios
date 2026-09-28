# Modelo de amenazas

Activos: datos por negocio, dinero/stock, sesiones, contraseñas, comprobantes, claves y auditoría. Límites de confianza: navegador→Next, Next→PostgreSQL, personal→soporte, webhooks→proveedor y runtime→KMS.

| Amenaza                             | Mitigación implementada                                                    | Límite o siguiente acción                                         |
| ----------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| IDOR entre negocios / WHERE omitido | Sesión, filtros, FK compuestas, FORCE RLS                                  | Control plane aún depende de autorización de aplicación           |
| Autoescalamiento de empleado        | RBAC en servidor, OWNER para roles propios, último propietario protegido   | RLS empresarial no implementa todos los permisos por módulo       |
| Personal curioso                    | Cookie separada, rutas empresariales denegadas, grants limitados/auditados | Administradores SQL/host siguen privilegiados                     |
| Robo de contraseña/sesión           | Argon2id, token hash, cookies, revocación                                  | MFA y detección de sesiones anómalas pendientes                   |
| CSRF/XSS                            | Origen, SameSite, CSP nonce, React escaping                                | style-src inline por componentes existentes                       |
| Webhook falso / doble cobro         | HMAC, consulta servidor a proveedor, idempotencia                          | Probar cuenta sandbox y credenciales reales antes de habilitar    |
| Doble venta/ajuste concurrente      | Transacciones, locks, claves de idempotencia, stock esperado               | Cliente viejo sin clave de movimiento debe actualizarse           |
| Archivo compartido/URL filtrada     | Sesión+empresa, HMAC, token hash y vencimiento                             | Proxy debe redactar query strings; no antivirus implementado      |
| Copia DB robada                     | Hash de credenciales, mínimos permisos                                     | Datos comerciales plaintext hasta migración; cifrar backups       |
| Manipulación de ciphertext          | GCM con AAD organización/registro/campo/versión                            | Servicio disponible, migración de campos pendiente                |
| Borrado de evidencias               | Auditoría append-only para runtime                                         | DBA puede modificar; pendiente sink externo                       |
| DoS / registro masivo               | Límites por acción e identidad, tamaños acotados en nuevas APIs            | Rate limit por IP en ingress y límite global de cuerpo pendientes |

Pruebas de abuso en `tests/security.mjs` y suites de integración/facturación. Ninguna prueba constituye una certificación; una revisión independiente y operación segura siguen siendo necesarias.
