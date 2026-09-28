# Facturación electrónica ARCA

## Alcance actual

Se diseñó un módulo fiscal independiente dentro del monolito con contratos `FiscalProvider`, `FiscalProfile`, `FiscalCredential`, `FiscalPointOfSale`, `FiscalInvoice`, `FiscalInvoiceItem` y `FiscalAttempt`. La primera integración prevista es `WSFEv1` en homologación.

El endpoint `GET /api/v1/fiscal/status` informa que el proveedor está preparado, pero no emite comprobantes. No se presentan PDFs locales como comprobantes autorizados.

## Fuentes oficiales consultadas

- ARCA Web Services: https://www.arca.gob.ar/ws/
- WSAA: https://www.arca.gob.ar/ws/documentacion/wsaa.asp
- Factura electrónica: https://www.arca.gob.ar/ws/documentacion/ws-factura-electronica.asp
- Manual WSFEv1 consultado desde la página oficial: Manual para el desarrollador ARCA COMPG V4.7.

La página oficial indica que WSFEv1 atiende comprobantes A, B, C y M sin detalle de ítem, además de CAE/CAEA solo para A y B según el alcance publicado. Exportación usa `wsfexv1` y comprobantes con detalle de ítems pueden requerir `wsmtxca`; no se asume que WSFEv1 cubra esos regímenes.

WSAA requiere un certificado X.509 emitido por la autoridad correspondiente y asociado al Web Service de negocio. Homologación y producción usan endpoints distintos.

## Pendiente externo

- Certificado X.509 de homologación.
- Asociación del certificado al WSN mediante WSASS.
- Confirmación contable de condición fiscal, comprobantes, impuestos y receptor.
- Definición de puntos de venta habilitados.
- Cliente SOAP WSAA/WSFEv1 con validación TLS y timeouts.

No solicitar ni almacenar clave fiscal. Certificados y claves privadas deben cifrarse en servidor o gestionarse mediante secret manager, con clave de cifrado separada de PostgreSQL. Los secretos no se loguean.

## Estados y seguridad

Una emisión debe pasar por borrador, pendiente, autorizado, rechazado o resultado incierto. Un timeout no equivale a rechazo: se debe consultar/reconciliar antes de reintentar. La numeración debe coordinarse por CUIT, ambiente, punto de venta y tipo; nunca usar solo `MAX(numero)+1`.