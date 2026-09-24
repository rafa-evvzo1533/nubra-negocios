# Ecosistema NUBRA

```text
NUBRA
|- Nubra Negocios  (web SaaS independiente)
|- Nubra Base      (desktop independiente)
|- Tienda Nubra    (ecommerce independiente)
|- Nubra AI        (servicios de IA)
`- Servicios compartidos (Auth, Billing, APIs, Webhooks)
```

Los productos se relacionan por contratos de API, webhooks, eventos, OAuth/SSO e integraciones. No se presupone una base de datos compartida. La identidad futura `account.nubra.app` debe poder emitir sesiones por producto sin acoplar sus dominios internos.
