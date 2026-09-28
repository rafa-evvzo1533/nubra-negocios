# Cifrado de aplicación

Estado: infraestructura de cifrado implementada y comprobada; los campos comerciales existentes todavía no se han migrado a ciphertext. No se alteraron datos existentes ni se almacenó una clave maestra junto a la base. Esto no es cifrado de extremo a extremo ni conocimiento cero.

`EncryptionService` usa AES-256-GCM, DEK aleatoria de 32 bytes por organización/versión, IV aleatorio de 12 bytes por valor, tag y AAD con organización, registro, campo y versión. El envelope serializable declara algoritmo, versión de formato, versión de clave, IV, tag y ciphertext. Cambiar empresa, registro, campo o ciphertext impide autenticar el valor. La DEK se limpia del Buffer tras usarla, sin afirmar borrado garantizado de toda la memoria del proceso.

`OrganizationKeyRepository` tiene implementación PostgreSQL con RLS. Guarda solamente la DEK envuelta y referencia al proveedor externo. `KeyManagementProvider` desacopla el servicio de Vault. `VaultKeyManagementProvider` implementa wrap/unwrap vía HTTPS y Transit, sin fallback a una clave local. No hay servicio Vault configurado ni llamadas reales de cifrado sobre datos de usuarios en esta entrega.

Rotar genera una nueva versión; se conservan las claves anteriores para descifrar registros previos. Una colisión concurrente de primera clave/rotación se rechaza por la PK compuesta, nunca sobreescribe otra clave. El consumidor debe serializar la rotación y reintentar tras releer la versión.

Siguiente migración controlada: provisionar y probar Vault; agregar columnas envelope paralelas para notas privadas, datos fiscales sensibles y secretos de integración; habilitar escrituras cifradas; convertir por lotes con checkpoints por empresa; verificar recuentos e integridad sin loguear texto; retirar plaintext solo después de restauración verificada y un período de transición acordado. Buscar/ordenar datos cifrados necesita un diseño aparte. No activar cifrado parcial silencioso ni borrar claves utilizadas por backups.

Las pruebas usan un proveedor de wrapping en memoria exclusivamente en `tests/security.mjs`; verifican roundtrip, manipulación, separación de contexto, rotación y lecturas anteriores.
