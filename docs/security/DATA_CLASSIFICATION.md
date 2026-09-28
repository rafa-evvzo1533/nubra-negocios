# Clasificación de datos

| Categoría              | Ejemplos                                    | Controles actuales                                                | Pendiente                                           |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Pública                | Marca, capacidades y catálogo visible       | Lectura pública sin datos empresariales                           | Revisión comercial de precios                       |
| Plataforma restringida | Solicitud, negocio, suscripción, membresía  | Staff RBAC y autorización por propietario                         | RLS adicional del plano de control, retención       |
| Empresa confidencial   | Clientes, notas, ventas, caja, comprobantes | Tenant context, RBAC, RLS, archivos autenticados, auditoría       | Migración de campos sensibles a envelope encryption |
| Credencial             | Contraseñas, tokens, API keys               | Argon2id/hash de tokens, cookies protegidas, secretos de servidor | MFA de staff, secret manager del despliegue         |
| Material criptográfico | DEK envuelta, KEK externa                   | Abstracción KMS y repositorio de claves con RLS                   | Provisionar proveedor y ejecutar migración          |
| Seguridad restringida  | Eventos, grants, sesiones                   | Append-only para runtime, redacción y revocación                  | Sink externo, alertas y política de retención       |

Los controles de aplicación no sustituyen cifrado de discos, backups, seguridad del sistema operativo ni administración de infraestructura. El acceso a datos debe ser el mínimo para la operación autorizada; no usar datos reales en pruebas. Las suites crean bases efímeras locales con información sintética.
