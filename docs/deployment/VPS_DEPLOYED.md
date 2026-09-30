# Despliegue verificado: 29 de septiembre de 2026 (Argentina)

URL pública: https://negocios.nubradigital.net

Administración: https://negocios.nubradigital.net/admin

Dominio propio activado el 30/09/2026 UTC. El hostname anterior
`srv1956999.hstgr.cloud` redirige con HTTP 308, conservando ruta y parámetros.

## Instalación

- VPS `179.199.145.15`, Ubuntu 26.04.1, sin reemplazar servicios existentes.
- Node.js 24.21.0 en `/opt/nubra-negocios/node`, con checksum oficial verificado.
  Se conserva el Node.js global que usan los otros proyectos.
- Versión inicial: `/opt/nubra-negocios/releases/20260930-https`, mediante el
  enlace `/opt/nubra-negocios/current`.
- Versión vigente: `/opt/nubra-negocios/releases/20260930-trials`, con
  portada interactiva y animaciones accesibles, logo oficial en recuperación,
  prueba de Business y renovación mensual implementada. Precios mensuales/anuales
  guardados en PostgreSQL; Mercado Pago pendiente de credenciales del propietario.
- Servicio systemd `nubra-negocios`, usuario sin privilegios `nubra-negocios`,
  escucha exclusivamente en `127.0.0.1:3200` y reinicia ante fallos.
- PostgreSQL 16 en el proyecto Docker Compose `nubra-negocios`, volumen propio,
  publicado solo en `127.0.0.1:55432`. Trece migraciones aplicadas, incluida
  `0012_trials_and_recurring.sql` para pruebas y autorizaciones mensuales.
  Base nueva; no se importaron datos del entorno local.
- Credencial web sin privilegios administrativos, miembro NOINHERIT de
  `nubra_runtime`. Secretos de ejecución y aprovisionamiento separados en
  `/etc/nubra-negocios/`, archivos root:root 0600.
- Nginx: sitio independiente `/etc/nginx/sites-available/nubra-negocios`.
  El sitio `/etc/nginx/sites-available/nubra-negocios-domain` atiende el dominio
  propio; el anterior conserva la redirección y la renovación de su certificado.
  Certificados Let's Encrypt, HTTPS público, redirección HTTP y renovación
  programada con recarga de Nginx.
- Administrador `nubra-admin`. La contraseña generada está en el archivo privado
  local `.local/vps-admin-access.txt`; no se versiona ni se muestra en logs.

## Comprobaciones realizadas

- `npm ci` y `npm run build` en Linux: OK. Se completó el lockfile con las
  dependencias opcionales que faltaban para una instalación limpia.
- `check-deployment.mjs` sobre la base real: secretos, HTTPS, rol SQL y esquema OK.
- `/api/health` público: HTTP 200 y `status: ok`, con validación TLS activa.
- Navegador Edge: portada, login real de administrador, consola interna,
  consulta autorizada de empresas, cierre de sesión y vista móvil de 390 px: OK.
  Cookie administrativa Secure/HttpOnly; sin errores de ejecución ni respuestas 5xx.
- Solicitud sin autenticación: 401. Orígenes externos, origen HTTP interno y
  cabeceras reenviadas falsificadas: 403. Cabecera HSTS presente.
- Se corrigió `src/proxy.ts` para comparar el origen con `APP_URL` en producción
  cuando Nginx termina HTTPS. `node --test tests/proxy.test.mjs`: OK.
- Respaldo PostgreSQL restaurado en una base temporal aislada: doce migraciones
  y administrador presentes. La base temporal se eliminó al finalizar.
- Tienda, TV y Alvear Shopping conservaron HTTP 200; contenedores existentes
  saludables y servicios de transmisión revisados activos.

## Operación

Consultar estado con `systemctl status nubra-negocios` y logs con
`journalctl -u nubra-negocios`. Las credenciales privadas no deben copiarse al
directorio de la aplicación ni incorporarse al repositorio.

El timer `nubra-negocios-backup.timer` crea un dump diario a las 06:15 UTC
(03:15 Argentina, con hasta cinco minutos de demora aleatoria) en
`/opt/nubra-negocios/backups`, con retención aproximada de catorce días.
Son copias en la misma VPS; falta configurar almacenamiento externo para cubrir
la pérdida completa del servidor. La restauración requiere también provisionar
los roles SQL, como detalla la guía de aislamiento.

`nubra-negocios-subscriptions.timer` ejecuta el vencimiento de pruebas cada cinco
minutos y también al acceder al negocio. Cuando se configure Mercado Pago,
la misma tarea conciliará las autorizaciones y facturas recurrentes. El servicio
corre como `nubra-negocios` con las credenciales limitadas de ejecución.

SMTP de Hostinger quedó habilitado el 30/09/2026 UTC: se verificaron TLS y
autenticación desde la VPS, y el propietario confirmó que recibió el correo de
verificación al registrarse. La configuración privada proviene del `.env` local
y no se publica en Git. Ver [correo SMTP](SMTP.md). Mercado Pago permanece
deshabilitado hasta configurar sus propias credenciales.

Para agregar un dominio propio, apuntarlo a la IP, incorporar el sitio/certificado
correspondiente y actualizar `APP_URL` al origen HTTPS elegido antes de reiniciar.
No requiere cambiar a Cloud Hosting. Ver [la guía VPS](HOSTINGER_VPS.md).

## Dominio propio y acceso administrativo

- Registro DNS: `A negocios → 179.199.145.15`, TTL 300. El propietario lo agregó
  desde la cuenta que administra `nubradigital.net`; la conexión API disponible
  no tiene acceso a ese dominio.
- `APP_URL=https://negocios.nubradigital.net` en el entorno privado de producción;
  los enlaces de correo y las verificaciones de origen usan este dominio.
- Certificado emitido para `negocios.nubradigital.net` y renovación automática
  configurada. El sitio conserva HTTPS en el hostname anterior para redirigir
  enlaces de verificación que ya fueron enviados.
- El administrador interno usa `nubra-admin` y la contraseña del archivo privado
  `.local/vps-admin-access.txt`. Es independiente de las cuentas de clientes
  creadas en `/register`; no fue necesario restablecer la contraseña.
- Verificado en el nuevo dominio: salud HTTPS, formulario de registro habilitado,
  login real de administrador en Edge, consola interna, cookie Secure/HttpOnly,
  cierre de sesión, vista móvil y rechazo de orígenes falsos. Sin errores de
  navegador ni respuestas 5xx durante el recorrido.
