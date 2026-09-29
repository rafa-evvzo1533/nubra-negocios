# Hostinger Cloud Hosting con hPanel

Preparado para **Cloud Hosting administrado**, no para un VPS. La aplicación usa Next.js completo con API, cookies y PostgreSQL; no es una exportación estática para copiar a `public_html`.

## Configuración de la aplicación

En hPanel → Sitios web → Agregar sitio → aplicación Node.js, conectá el repositorio `rafa-evvzo1533/nubra-negocios`, rama `main`, raíz `/`. Configurá:

| Opción | Valor |
| --- | --- |
| Framework | Next.js |
| Node | 24.x |
| Instalación | npm ci (o la instalación administrada por hPanel) |
| Build | npm run build:hostinger |
| Salida | .next |
| Inicio | npm run start:hostinger |
| Puerto | 3000, o PORT asignado por la plataforma |
| Variables | Plantilla deploy/hostinger/runtime.env.example |

Si hPanel utiliza `npm start`, `DEPLOYMENT_TARGET=hostinger` selecciona el arranque alojado. Este arranque sirve el build: no mata procesos, no busca otro puerto, no ejecuta migraciones y no recompila. hPanel controla reinicios, HTTPS y routing. En local, `npm start` conserva el inicio integral anterior.

OCR se prepara en el build y sus archivos se sirven localmente. No subir `.env`, `.local`, `node_modules`, `.next`, logs ni respaldos al repositorio o ZIP fuente.

## PostgreSQL externo y aislamiento

Hostinger admite Node.js en Cloud, pero no ofrece PostgreSQL local en ese plan. Usá un PostgreSQL externo dedicado que permita crear el rol `nubra_runtime`, funciones/políticas RLS y un login restringido. El asistente de hPanel puede conectar Supabase; **no reemplaza** estas migraciones ni la separación de credenciales. Verificá conectividad IPv4/IPv6 y elegí conexión directa o pool en modo sesión compatible con la operación requerida. La migración requiere conexión de administración directa y soporte de los privilegios indicados.

1. Crear el proyecto/base externa y obtener una conexión administrativa protegida con TLS. No usar MySQL: el esquema y RLS requieren PostgreSQL.
2. Desde una máquina de confianza, usar una configuración de despliegue separada para `MIGRATION_DATABASE_URL`; ejecutar `npm run migrate` y `npm run setup:admin` con credenciales fuertes de bootstrap. No apuntar por accidente a la base local; verificar el destino sin publicar la URL ni contraseña.
3. Crear un login propio de la web con `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`, otorgarle pertenencia a `nubra_runtime` y conexión a esta base. `scripts/provision-runtime.mjs` sigue limitado al entorno local: no rota automáticamente credenciales remotas.
4. En hPanel cargar **solo** la URL de ese login en `DATABASE_URL`, con TLS verificado. No cargar `MIGRATION_DATABASE_URL`, `ADMIN_PASSWORD` ni credenciales del dueño de la base. El arranque alojado rechaza esos secretos de bootstrap/migración.
5. Si el proveedor publica una API automática sobre el esquema `public`, deshabilitarla para estas tablas y retirar acceso de roles anónimos/autenticados ajenos a Nubra. No dar al navegador claves de servicio ni conexión SQL. Usar base/proyecto dedicado, no aplicar estos cambios sobre aplicaciones ajenas.
6. Con el entorno final de runtime ejecutar `npm run check:deployment` desde una máquina de confianza. Comprueba URL, TLS, rol restringido y última migración sin imprimir credenciales.

La plantilla limita el pool a cinco conexiones por proceso. Ajustar `DATABASE_POOL_MAX` según el total de procesos y el proveedor; no dar una conexión privilegiada al runtime para resolver un error de permisos.

## Dominio, correo y cobros

Configurar dominio y HTTPS en hPanel, y `APP_URL=https://tu-dominio`. Usar secretos aleatorios distintos de al menos 32 caracteres. Habilitar SMTP y verificar registro, recuperación e invitaciones.

Para pagos, seguir [Mercado Pago](../integrations/SUBSCRIPTIONS.md): webhook público `/api/billing/mercadopago/webhook`, vendedor/entorno correctos y precios mensuales/anuales desde `/internal`. Probar primero con cuentas de prueba del proveedor. No cargar los precios sugeridos automáticamente.

## Actualizaciones y comprobaciones

Aplicar migraciones de la versión desde el proceso de despliegue separado; luego Redeploy en hPanel. Comprobar `/api/health` (200), login, estilos/logo, una operación autorizada, aislamiento entre negocios y el retorno del pago. `/internal` permanece accesible por URL para personal autorizado, aunque ya no aparezca en la web pública.

Guardar un backup externo y comprobar restauración antes de cambios de esquema. Para volver al código anterior, elegir el commit anterior solo si es compatible con el esquema aplicado; no se hace downgrade automático ni se borra información. hPanel no sustituye el plan de recuperación de PostgreSQL.

## Alcance de la entrega

Se entregan scripts, plantilla y documentación. No se ha entrado a tu hPanel ni se ha desplegado en tu cuenta; faltan dominio, conexión externa, credenciales y configuración de proveedores. El comando de validación no demuestra conectividad real hasta ejecutarlo con esa configuración.

Referencias oficiales consultadas el 29/09/2026: [aplicaciones Node.js, frameworks, versiones y base externa](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [bases soportadas por plan](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/), [comandos y redeploy](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/). Las opciones visibles pueden variar según el plan y la interfaz de hPanel.
