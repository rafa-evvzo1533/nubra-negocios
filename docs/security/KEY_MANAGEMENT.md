# Gestión de claves

La KEK pertenece al servicio externo; PostgreSQL conserva DEK envueltas. No poner KEK o tokens de proveedor en NEXT_PUBLIC, repositorio, auditorías, logs ni backups SQL. El token del proveedor sigue siendo un secreto privilegiado del runtime: usar identidad de workload o credenciales breves en el despliegue definitivo.

El adaptador disponible usa Vault Transit montado en `/transit`, clave `aes256-gcm96`, `derived=true`, sin exportación ni backups plaintext. El contexto es organización:versión codificado en base64. Asignar al runtime solo encrypt/decrypt de la clave configurada; administrar creación, rotación, revocación y políticas con una identidad separada. Contrato verificado con la [API oficial de Vault Transit](https://developer.hashicorp.com/vault/api-docs/secret/transit).

Preparar alta disponibilidad y restauración del almacén de claves antes de migrar campos. Un dump SQL no basta para recuperar información cifrada. Registrar rotaciones por ID/versión, nunca material criptográfico. En pérdida o compromiso: revocar identidad afectada, preservar registros, emitir nueva credencial, evaluar rewrap de DEK y posterior recifrado; no destruir versiones necesarias para restauraciones.

`FILE_SIGNING_SECRET` es independiente del cifrado de campos. Es una clave HMAC de al menos 32 caracteres aleatorios para enlaces de 5 minutos. Rotarla invalida enlaces pendientes. Los tokens de sesión/verificación se guardan como hashes. Contraseñas nuevas: Argon2id; hashes scrypt anteriores se actualizan al autenticar correctamente.
