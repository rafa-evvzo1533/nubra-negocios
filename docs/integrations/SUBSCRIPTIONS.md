# Suscripciones y Mercado Pago

Los planes son Free, Lite, Business y Enterprise. Sus capacidades y límites salen de PostgreSQL. Free se asigna al aprobar una solicitud. Los precios comienzan vacíos: el sistema no inventa importes ni permite pagar sin configuración.

La VPS tiene cargados los [precios aprobados](../product/PRICING_PROPOSAL.md)
por el propietario. Configurar precios y habilitar Mercado Pago son pasos independientes.

## Pantallas

- `/register-business`: entrada visible al registro y estado de la solicitud.
- `/plans`: planes, beneficios realmente disponibles y precios configurados.
- `/settings/subscription`: plan actual, vigencia, consumo, compra e historial de pagos. **Comprar plan** abre la confirmación de pago; si el proveedor o el precio no están habilitados, informa que el pago online no está disponible y deshabilita el pago. No crea una solicitud comercial como reemplazo.
- `/internal`, pestaña Planes: precios mensuales y anuales en ARS, habilitación independiente de cada modalidad y capacidades. Requiere permisos internos de facturación.
- `/internal`, pestaña Empresas y suscripciones: muestra el vencimiento y permite conservarlo, asignar 14 días, uno o tres meses, un año, una fecha/hora personalizada o sin vencimiento. Los períodos comienzan al guardar; la fecha personalizada usa la zona horaria del dispositivo. El servidor valida y registra el vencimiento en auditoría. La opción inicial conserva la vigencia actual.

## Configuración

1. Ejecutar `npm run migrate` y configurar el correo SMTP para registro e invitaciones.
2. Configurar `APP_URL` con la URL pública HTTPS, `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID` (identificador del vendedor) y `MP_WEBHOOK_SECRET` de la aplicación de Mercado Pago, únicamente en el servidor.
3. Registrar `https://negocios.nubradigital.net/api/billing/mercadopago/webhook`, habilitando `payment`, `subscription_preapproval` y `subscription_authorized_payment`. El mismo endpoint enruta cada tipo; `/api/billing/mercadopago/subscriptions` también admite los eventos de suscripción.
4. Usar `MP_MODE=sandbox` y credenciales/cuentas de prueba; activar `BILLING_ENABLED=true`. Para producción usar `MP_MODE=live` y las credenciales correspondientes.
5. Cargar el precio y marcar “Habilitar compra de este plan” en administración. Reiniciar el servidor tras cambiar variables de entorno.

Los nuevos planes mensuales usan Suscripciones de Mercado Pago: autorización mediante `/preapproval`, frecuencia de un mes y consentimiento explícito antes de continuar al proveedor. Los anuales conservan Checkout Pro con pago único. Los pedidos antiguos conservan su modalidad; los anteriores a `0011` mantienen 30 días (`LEGACY_30_DAYS`). Los precios se guardan al contratar y no se modifican retroactivamente al editar el catálogo.

El propietario dejó las credenciales de Mercado Pago pendientes para una próxima etapa. El código se verifica con un proveedor simulado; la VPS mantiene los cobros deshabilitados. Antes de habilitarlos se debe probar una autorización, un cobro y una cancelación con las cuentas reales de prueba del proveedor.

## Prueba de Business y renovación mensual

Un responsable de un negocio aprobado en Free puede reclamar Business por 14 días, una sola vez por negocio. No requiere tarjeta ni crea una autorización de pago. La migración `0012` registra el inicio y el fin; la función `nubra_expire_trials` devuelve el negocio a Free conservando datos e historial. Se ejecuta al acceder al negocio y cada cinco minutos con `nubra-negocios-subscriptions.timer`.

La renovación mensual es independiente de esa prueba. La autorización pendiente o autorizada no concede acceso por sí sola: se consulta la factura en `/authorized_payments/{id}` y el pago en `/v1/payments/{id}`. Se comprueban vínculo, vendedor, ambiente, importe y moneda antes de acreditar. Una factura repetida no extiende dos veces la vigencia. Cada nuevo pago crea un pedido mensual auditable.

El botón **Cancelar renovación** revoca la autorización en Mercado Pago y solo confirma el resultado después de verificar `cancelled`. Conserva el período ya pagado. Hay una sola autorización abierta por negocio; una creación incierta queda en revisión para evitar cobros duplicados. Se puede consultar el estado desde la pantalla, al regresar del proveedor y mediante la tarea programada. Los eventos de pago siguen procesando devoluciones de pedidos recurrentes conocidos.

Los vencimientos nuevos agregan uno o doce meses en UTC, ajustando al último día si no existe el día original (31/enero → último día de febrero; 29/febrero anual → 28/febrero siguiente). Renovar el mismo plan activo suma el período después del vencimiento vigente. Las cuotas de ventas/exportaciones siguen siendo mensuales, incluso al pagar anual. Los precios anuales se cargan por su importe total; no hay descuento inventado ni multiplicación automática por doce.

## Garantías

El importe, moneda, negocio y plan salen del servidor. La compra requiere OWNER/ADMINISTRATOR/ADMIN del negocio aprobado; los roles personalizados no pueden contratar. Idempotencia por negocio y bloqueo de pedidos pendientes evitan duplicar checkouts por reintentos. No se superponen planes distintos ni se reemplazan beneficios comerciales activos por una compra.

El webhook exige HMAC SHA-256, timestamp reciente y request ID. Luego consulta el pago en la API del proveedor y verifica vendedor, entorno, importe, moneda y referencia. Solo un pago aprobado cambia el plan. La URL de retorno y su query no acreditan pagos. Eventos repetidos no extienden la vigencia dos veces. Los errores inciertos quedan en revisión y bloquean otra compra para el negocio; necesitan conciliación operativa antes de desbloquearlos.

Devoluciones/contracargos del pedido vigente vuelven a Free. Si hubo una concesión manual posterior, la devolución no la revoca. Devoluciones parciales y devoluciones de períodos anteriores renovados requieren revisión comercial: no se emiten devoluciones desde esta web. Se conservan pedidos, eventos e historial; no se eliminan datos del negocio.

Una suscripción vencida deja de resolver capacidades; el responsable conserva acceso a la sección de suscripción para renovar. Fuentes soportadas: FREE_REGISTRATION, DIRECT_PURCHASE, NUBRA_BASIC_BUNDLE, NUBRA_ENTERPRISE_BUNDLE, MANUAL_GRANT, PROMOTION y MIGRATION.

## Retorno del pago y avisos

Al regresar a suscripción con un pedido, la página consulta su estado durante hasta dos minutos. Si Mercado Pago proporciona `payment_id` o `collection_id`, solicita al servidor una conciliación autenticada; primero se comprueba que el pedido pertenece al negocio y después se consulta la API del proveedor. Esta vía usa exactamente las mismas validaciones que el webhook. Un parámetro `status=approved` por sí solo no tiene efecto.

Cuando el pedido queda acreditado, aparece un único aviso arriba a la derecha y se refrescan plan, vigencia y capacidades. Los avisos tienen contraste, cierre manual y permanecen visibles sobre los diálogos, también en móvil. Si la notificación llega después o el usuario cierra la página, el webhook sigue activando el plan. El botón Actualizar estado permite volver a consultar. Fallos, revisiones y devoluciones permanecen visibles en el historial.

Free carece de vencimiento; sus límites de uso se detallan en [capacidades](../product/ENTITLEMENTS.md). Los precios continúan configurables y no se inventan valores para habilitar pagos.

Referencias oficiales: [crear suscripción](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-preapproval/post), [consultar suscripción](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-preapproval/get), [actualizar o cancelar](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/update-preapproval/put), [facturas recurrentes](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-authorized-payment/get) y [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks).
