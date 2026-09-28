# Inicio y despliegue

1. Instalar Node y PostgreSQL compatibles con las dependencias fijadas en `package-lock.json`, ejecutar `npm ci`.
2. Completar `.env` desde `.env.example`. Separar `MIGRATION_DATABASE_URL` del login restringido de `DATABASE_URL`, siguiendo [RLS](../security/RLS.md).
3. Ejecutar `npm start`. Aplica migraciones, comprueba el administrador, prepara OCR local, compila todas las rutas y sirve la aplicación.
4. Al repetirlo, se detiene únicamente un servidor Node identificado como perteneciente a este proyecto. Si el puerto lo ocupa otra aplicación se toma el siguiente disponible. La URL efectiva aparece en la terminal.
5. Para desarrollo con recarga automática, usar `npm run dev`; para un despliegue con build previo, `npm run build` y `npm run start:server`.

La migración `0010_commerce.sql` agrega proveedores, atributos de catálogo, costos históricos, idempotencia comercial, permisos y cuotas mensuales. Conserva registros existentes; ajusta límites de los cuatro planes y precarga el uso de ventas del mes actual. Revisar las capacidades comerciales después de migrar si existían acuerdos particulares.

Antes de servir desde otra máquina: HTTPS, URL pública, correo, rol SQL restringido, proceso persistente/supervisor, copias de seguridad y monitoreo. Configurar Mercado Pago y precios según [suscripciones](../integrations/SUBSCRIPTIONS.md). El comando local no aprovisiona un servidor público ni la cuenta de cobros.

Las credenciales generadas localmente están en `.local/admin-access.txt`; no se suben al repositorio. `npm run setup:admin -- --reset` rota a una contraseña segura configurada; `--generate-local` genera una aleatoria. El inicio ordinario conserva la contraseña actual.
