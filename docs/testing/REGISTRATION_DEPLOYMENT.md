# Registro, publicación y limpieza · 30/09/2026 UTC

## Cambios

- Correo de Hostinger habilitado en la VPS, con verificación de autenticación y
  TLS. El propietario confirmó la llegada del correo de registro a su casilla.
- Si falta correo, la página informa que el registro está pausado antes de pedir
  datos. La API devuelve 503 sin consumir intentos y sin crear una cuenta.
- Corrección del origen HTTPS público detrás de Nginx, conservando el rechazo
  de orígenes externos y cabeceras reenviadas falsificadas.
- Los avisos no intentan abrir un popover desconectado cuando se cierra un diálogo.
  La creación de roles comprueba que el aviso siga visible y no rompa la página.
- Horas del dashboard en formato de 24 horas para evitar diferencias de espacios
  en los indicadores AM/PM entre el servidor y el navegador.

## Archivos retirados

Se verificó que no tenían consumidores y se eliminaron diez archivos:

- `src/components/dashboard/DashboardView.tsx` y su CSS: maqueta anterior, sustituida por `Overview`.
- `src/components/layout/Header.tsx`, `Sidebar.tsx` y sus CSS: navegación anterior sin referencias.
- `src/components/overlays/NubraOverlays.tsx` y su CSS: paneles de demostración sin conexión al producto.
- `src/components/data.ts`: datos de muestra usados solamente por esas maquetas.
- `prisma/schema.prisma`: esquema parcial sin uso; se quitó también `@prisma/client`.

Se conservan migraciones, pruebas, documentación histórica, activos OCR necesarios,
credenciales privadas y respaldos. PostgreSQL continúa usando `pg` y SQL versionado.

## Secretos

Se reemplazaron las credenciales reales que se habían agregado a `.env.example`
por una plantilla. Los archivos candidatos al commit se comprobaron contra las
credenciales privadas conocidas. Los valores anteriores siguen en el historial
de Git y requieren rotación; las credenciales de producción se generaron aparte.

## Verificación

Las pruebas de correo sin configuración usan un proceso separado con una URL
de base inalcanzable: verifican el aviso previo, cuatro respuestas 503 y que el
registro no intente escribir ni consumir límites durante la indisponibilidad.
La suite de foundation recorre registro, recepción SMTP local, verificación,
solicitud y aprobación. El correo externo se confirmó con el registro del usuario.

Resultado final: `npm run build`, `npm run lint` y `npm run test:all` correctos.
La suite completa pasó ocho tests unitarios, 90 comprobaciones de foundation,
100 de roles/pagos, 63 de comercio, 65 de seguridad, 144 de integración,
63 de operaciones y 126 de responsive, además del recorrido de navegador.
Incluye OCR real, avisos al cerrar diálogos y recreación de la base con replay
de migraciones. Logs privados en `.local/deploy/`.

La versión Linux se instaló con `npm ci` y compiló correctamente antes de
activar `/opt/nubra-negocios/releases/20260930-registration`.
