# Documentación de Nubra Negocios

El [estado del proyecto](project-status.md) describe la entrega vigente. Los documentos de `archive/` conservan entregas anteriores y no sustituyen ese estado.

| Carpeta | Contenido |
| --- | --- |
| [adr](adr/001-commerce-and-payments.md) | Decisiones de integración, pagos y planes |
| [architecture](architecture/ARCHITECTURE.md) | Arquitectura, base de datos y aislamiento |
| [deployment](deployment/LOCAL_AND_PRODUCTION.md) | Instalación, inicio y migraciones |
| [integrations](integrations/SUBSCRIPTIONS.md) | Mercado Pago, API y adaptadores |
| [runbooks](runbooks/ADMIN_PANEL.md) | Administración, incidentes y recuperación |
| [security](security/SECURITY.md) | Permisos, RLS, soporte, archivos, cifrado y límites actuales |
| [testing](testing/TESTING.md) | Suites automatizadas y auditorías |
| [product](product/COMMERCE.md) | Funciones y operación comercial |
| [legal](legal/LEGAL.md) | Textos versionados y revisión pendiente |
| [archive](archive/IMPLEMENTATION_REPORT.md) | Historial de entregas y contexto anterior |

- [Comparación con nubra-comercio-main](product/REFERENCE_COMPARISON.md).
- [Planes y límites](product/ENTITLEMENTS.md).
- [Funciones que se pueden agregar](product/FEATURE_IDEAS.md).
- [API de los nuevos módulos](integrations/COMMERCE_API.md).

`README.md` mantiene el inicio rápido. `AGENTS.md` y `CLAUDE.md` permanecen en la raíz porque son instrucciones consumidas por herramientas del proyecto. Credenciales, logs y capturas locales quedan fuera de Git en `.local/`.
