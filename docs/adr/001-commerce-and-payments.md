# ADR 001: comercio, pagos verificados y Free por uso

Estado: aceptado. Fecha: 2026-09-28.

- Se incorporan funciones de la referencia al proyecto actual; se conserva su interfaz y arquitectura SaaS.
- Venta, stock, cuota y cobro se guardan juntos en PostgreSQL. Las cuentas corrientes se derivan de ventas/pagos para evitar dos saldos contradictorios.
- Free no tiene vencimiento. Las capacidades se validan en servidor y cada operación que supera un límite se rechaza sin borrar datos. Ventas y exportaciones reinician cuota en el siguiente mes calendario UTC.
- Los precios permanecen configurables. Mercado Pago Checkout Pro cobra períodos de 30 días, con renovación manual. La aprobación activa el plan automáticamente; no implica débito recurrente.
- Webhooks firmados y consulta autenticada al volver del checkout pasan por la misma conciliación. Nunca se acredita por parámetros `status=approved` del navegador.
- Los avisos son de la web; una bandeja persistente y push quedan para una evolución posterior.
- No se importa el mecanismo de sobrescritura de todo el estado JSON de la referencia. La base relacional, RLS y el historial transaccional permanecen como fuente de verdad.
