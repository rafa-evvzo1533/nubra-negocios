# Suscripciones y Mercado Pago

Los planes son Free, Lite, Business y Enterprise. Sus capacidades y límites salen de PostgreSQL. Free se asigna al aprobar una solicitud. Los precios comienzan vacíos: el sistema no inventa importes ni permite pagar sin configuración.

## Pantallas

- `/register-business`: entrada visible al registro y estado de la solicitud.
- `/plans`: planes, beneficios realmente disponibles y precios configurados.
- `/settings/subscription`: plan actual, vigencia, consumo, contratación, consulta comercial e historial de pagos.
- `/internal`, pestaña Planes: precios en ARS por 30 días, habilitación de compra y capacidades. Requiere permisos internos de facturación.

## Configuración

1. Ejecutar `npm run migrate` y configurar el correo SMTP para registro e invitaciones.
2. Configurar `APP_URL` con la URL pública HTTPS, `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID` (identificador del vendedor) y `MP_WEBHOOK_SECRET` de la aplicación de Mercado Pago, únicamente en el servidor.
3. Registrar el webhook de pagos en `https://tu-dominio/api/billing/mercadopago/webhook`, habilitando el evento de pagos.
4. Usar `MP_MODE=sandbox` y credenciales/cuentas de prueba; activar `BILLING_ENABLED=true`. Para producción usar `MP_MODE=live` y las credenciales correspondientes.
5. Cargar el precio y marcar “Habilitar compra de este plan” en administración. Reiniciar el servidor tras cambiar variables de entorno.

La implementación usa Checkout Pro: pago único por 30 días y renovación manual, sin débito automático. No se integró la API de suscripciones recurrentes. Los pedidos ya creados mantienen el precio original durante su vigencia de 24 horas. La operación del proveedor debe validarse con cuentas de prueba reales antes de habilitar cobros públicos; las pruebas automatizadas usan una API simulada local.

## Garantías

El importe, moneda, negocio y plan salen del servidor. La compra requiere OWNER/ADMINISTRATOR/ADMIN del negocio aprobado; los roles personalizados no pueden contratar. Idempotencia por negocio y bloqueo de pedidos pendientes evitan duplicar checkouts por reintentos. No se superponen planes distintos ni se reemplazan beneficios comerciales activos por una compra.

El webhook exige HMAC SHA-256, timestamp reciente y request ID. Luego consulta el pago en la API del proveedor y verifica vendedor, entorno, importe, moneda y referencia. Solo un pago aprobado cambia el plan. La URL de retorno y su query no acreditan pagos. Eventos repetidos no extienden la vigencia dos veces. Los errores inciertos quedan en revisión y bloquean otra compra para el negocio; necesitan conciliación operativa antes de desbloquearlos.

Devoluciones/contracargos del pedido vigente vuelven a Free. Si hubo una concesión manual posterior, la devolución no la revoca. Devoluciones parciales y devoluciones de períodos anteriores renovados requieren revisión comercial: no se emiten devoluciones desde esta web. Se conservan pedidos, eventos e historial; no se eliminan datos del negocio.

Una suscripción vencida deja de resolver capacidades; el responsable conserva acceso a la sección de suscripción para renovar. Fuentes soportadas: FREE_REGISTRATION, DIRECT_PURCHASE, NUBRA_BASIC_BUNDLE, NUBRA_ENTERPRISE_BUNDLE, MANUAL_GRANT, PROMOTION y MIGRATION.

Referencias oficiales: [Preferencias de Checkout Pro](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/create-preference/post) y [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks).
