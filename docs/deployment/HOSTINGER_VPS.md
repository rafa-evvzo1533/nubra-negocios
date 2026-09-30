# Nubra Negocios en una VPS

La VPS ejecuta Node.js 24 y PostgreSQL; no requiere Cloud Hosting. Esta guía usa
Linux con systemd, PostgreSQL local y Nginx (o Caddy) como proxy HTTPS. Revisar primero el
sistema operativo, memoria, servicios y puertos del servidor elegido. Las plantillas
no instalan ni reemplazan servicios automáticamente.

## Dirección pública

Un dominio registrado en Hostinger u otro proveedor se puede apuntar a la VPS con
un registro A a su IPv4. Agregar AAAA solamente si la IPv6 está configurada.
No es necesario comprar un plan Cloud para usar un dominio con la VPS.

Sin dominio propio se puede usar un hostname temporal que resuelva a la VPS y
admita un certificado público. Verificar primero su resolución y que se pueda
emitir el certificado; el hostname que figura en el panel no garantiza ambas cosas.
La configuración incluida espera un hostname, no una IP como nombre del sitio.

**No publicar el login por HTTP:** las cookies de producción requieren HTTPS.
La IP sirve para acceder por SSH y preparar el servidor. Para una revisión privada
sin dominio se puede usar un túnel SSH a localhost, sin exponer el puerto 3200:

```powershell
ssh -N -L 3000:127.0.0.1:3200 usuario@IP_VPS
```

Usar el puerto SSH real si es distinto de 22. Esta revisión no sustituye la
verificación del HTTPS público, correo ni callbacks de pagos.

## Preparación

1. Confirmar la VPS de destino y hacer respaldo de cualquier servicio o base
   existente antes de modificarla. Mantener su acceso SSH y sus reglas de firewall.
2. Instalar Node.js 24 bajo `/opt/nubra-negocios/node` verificando su checksum oficial,
   para conservar las versiones de otros servicios. La unidad usa ese binario.
   PostgreSQL puede ejecutarse con `deploy/vps/postgres.compose.yml`: volumen propio,
   reinicio automático y puerto publicado solo en `127.0.0.1:55432`. Guardar
   `POSTGRES_USER=nubra_owner`, `POSTGRES_DB=nubra_negocios` y una contraseña nueva
   en `/etc/nubra-negocios/postgres.env` (root:root, modo 0600). Si se usa PostgreSQL
   nativo, adaptar el puerto. No compartir bases ni secretos con otros proyectos.
3. Crear un usuario de servicio `nubra-negocios`, sin privilegios administrativos, y un
   directorio de versión bajo `/opt/nubra-negocios/releases/`. El enlace
   `/opt/nubra-negocios/current` debe apuntar a la versión que se va a ejecutar.
4. Transferir código, `package-lock.json`, `public/`, `migrations/` y `scripts/`.
   No transferir `.env`, `.local`, `.git`, `node_modules`, `.next`, `.next-dev` ni
   resultados de pruebas del equipo Windows. Instalar y compilar en Linux para
   obtener los binarios correctos de Argon2 y Next.js. No copiar bases locales
   empresariales como parte del código.
5. En la versión nueva ejecutar `npm ci` y `npm run build` como usuario sin
   privilegios. El postinstall prepara los recursos OCR. El usuario `nubra-negocios`
   necesita lectura del código y escritura en `.next` para la caché.

## PostgreSQL y secretos

Crear una base dedicada y aplicar [las migraciones](MIGRATIONS.md) con una
credencial de despliegue que permita crear el rol `nubra_runtime`. Crear después
un login exclusivo de la aplicación, según [RLS](../security/RLS.md):

```sql
CREATE ROLE nubra_web LOGIN PASSWORD 'REEMPLAZAR_POR_SECRETO_GENERADO'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
GRANT nubra_runtime TO nubra_web;
```

El login de ejecución no debe ser propietario de tablas. PostgreSQL debe escuchar
solo en loopback si se instala en esta VPS; no abrir 5432 a Internet.

Guardar la configuración de ejecución de
`deploy/vps/runtime.env.example` en `/etc/nubra-negocios/runtime.env`, propietario
root y modo 0600. Generar dos secretos aleatorios independientes y una contraseña
SQL nueva. `APP_URL` debe coincidir con el origen HTTPS final.

Mantener `MIGRATION_DATABASE_URL`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` en un archivo
separado `/etc/nubra-negocios/provision.env`, root:root y modo 0600. Desde la versión
preparada, un administrador ejecuta una vez:

```bash
sudo /opt/nubra-negocios/node/bin/node --env-file=/etc/nubra-negocios/provision.env scripts/migrate.mjs
sudo /opt/nubra-negocios/node/bin/node --env-file=/etc/nubra-negocios/provision.env scripts/bootstrap-admin.mjs
```

El bootstrap conserva las cuentas existentes. No usar `--reset` ni
`--generate-local` para desplegar. No guardar ningún `.env` en el directorio de la
aplicación: Next.js lo cargaría también en ejecución. El proceso web recibe solo
`runtime.env`; nunca recibe la credencial de migraciones o la contraseña del admin.

`check:deployment` admite PostgreSQL en loopback cuando `DEPLOYMENT_TARGET=vps`.
Una base remota sigue requiriendo verificación TLS. El comprobador mantiene las
validaciones de HTTPS público, secretos, rol restringido y migración aplicada.

## Servicio y HTTPS

1. Instalar `deploy/vps/nubra-negocios.service` en `/etc/systemd/system/` después
   de revisar rutas, usuario y puerto. La unidad sirve el build existente, comprueba
   base/configuración y se reinicia ante fallos. No migra ni compila al arrancar.
2. Si ya existe Nginx, agregar `deploy/vps/nginx.conf.example` como sitio independiente
   y reemplazar el hostname. Primero habilitar solamente el bloque HTTP y su ruta
   ACME; emitir el certificado con Certbot webroot y luego habilitar el bloque HTTPS.
   El proxy apunta a `127.0.0.1:3200`. Conservar los sitios existentes.
3. Habilitar 80/443 conservando SSH. Configurar renovación automática del certificado
   y recarga de Nginx; validar con `nginx -t` antes de recargarlo. Si no hay otro proxy,
   `deploy/vps/Caddyfile.example` es una alternativa con HTTPS automático.
4. Ejecutar `sudo systemctl daemon-reload` y
   `sudo systemctl enable --now nubra-negocios`.
5. Revisar `systemctl status nubra-negocios`,
   `journalctl -u nubra-negocios -n 100 --no-pager` y
   `curl --fail https://HOSTNAME/api/health`.
6. Comprobar login de administrador, estilos/OCR, una operación autorizada y
   aislamiento de negocios desde el navegador. Registrar la URL y el resultado.

El registro y la recuperación de cuentas requieren SMTP real; con
`MAIL_ENABLED=false` no envían mensajes. Mercado Pago queda deshabilitado hasta
configurar credenciales, precios y el webhook HTTPS. La publicación inicial no
implica que correo y cobros estén habilitados.

## Actualizaciones y respaldo

Preparar cada versión en su propio directorio, respaldar PostgreSQL, aplicar las
migraciones compatibles y luego cambiar `current` y reiniciar el servicio.
No sobreescribir el build de un proceso que todavía sirve peticiones. El rollback
del código no revierte migraciones: comprobar compatibilidad antes de usar la
versión anterior. Programar y probar [copias de seguridad](../runbooks/BACKUP.md).
Con PostgreSQL en el Compose incluido, instalar `backup.sh` y las unidades
`nubra-negocios-backup.service` / `.timer` de `deploy/vps/`. El respaldo diario
queda en `/opt/nubra-negocios/backups`; falta agregar una copia externa para
protegerse de la pérdida de la VPS completa.

Estas plantillas requieren validación en la VPS elegida; no prueban por sí solas
que exista un despliegue remoto.

La instalación realizada y sus comprobaciones están registradas en
[VPS_DEPLOYED.md](VPS_DEPLOYED.md).
