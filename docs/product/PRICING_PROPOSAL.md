# Precios aprobados

Precios indicados por el propietario y cargados en producción el 30/09/2026 UTC.
Importes en pesos argentinos (ARS). Reemplazan la propuesta anterior.

| Plan | Mensual | Anual, pago total | Ahorro anual |
| --- | ---: | ---: | ---: |
| Free | $0 | $0 | — |
| Lite | $5.000 | $50.000 | $10.000 |
| Business | $10.000 | $100.000 | $20.000 |
| Enterprise | $20.000 | $200.000 | $40.000 |

El anual equivale a diez mensualidades. Es el pago del año completo. Los importes
se configuran por separado en `/internal`, pestaña Planes. La interfaz calcula el
ahorro comparando doce mensualidades con el precio anual vigente y lo muestra
solo cuando ambos precios están definidos y existe un ahorro positivo.

Los seis importes se guardaron mediante la API administrativa auditada, sin
alterar capacidades, pedidos existentes ni habilitación del pago online.
Free continúa gratis y sin vencimiento. Mercado Pago requiere completar su
[configuración independiente](../integrations/SUBSCRIPTIONS.md).

Validación: lint, build local/Linux y `npm run test:foundation` correctos.
Se comprobaron los precios y ahorros en el sitio público con Edge, en anchos
de 1440 y 390 px, sin desbordamiento horizontal ni errores de navegador.
