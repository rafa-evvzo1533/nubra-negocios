# Roadmap de Nubra Negocios

## Fase 0 — Auditoría

Completada en REPOSITORY_AUDIT.md: arquitectura existente, seguridad, persistencia y brechas. Se preservó el trabajo local previo.

## Fase 1 — Foundation y primer core

Implementado: migraciones reproducibles, registro/email, solicitudes, aprobación/rechazo/información, workspace, miembros/roles/permisos, personal NUBRA separado, planes/capacidades/consumo/historial, términos/privacidad/aceptación, auditoría y paneles. El core recibido ya aporta clientes, catálogo, stock, ventas, pagos y caja. Se añadieron idempotencia y cancelación no cobrada, CSV aislado y pruebas del flujo.

También implementado: invitaciones por email, roles personalizados, permisos por acción, gestión de sesiones y logo oficial. Pendiente: MFA para personal, reaceptación legal para cuentas activas, comunicaciones por outbox y onboarding guiado.

## Fase 2 — Core Business

Completar Opportunity/Pipeline/Lead independientes y timeline unificado; servicios y variantes; Warehouse/InventoryItem/transferencias; estados financieros de venta, devoluciones y pagos asociados; múltiples cajas. Migrar saldos mediante reconciliación, no recalcular historial inexistente. Mantener tests de aislamiento, idempotencia y rollback.

## Fase 3 — Operations

Proveedores, venta rápida, cuentas corrientes y equipos según cuotas ya están implementados. Pendiente: compras/recepción parcial, tareas, agenda, archivos S3 con cuarentena/MIME/antivirus, notificaciones persistentes y CSV con mapeo, validación, vista previa e importación confirmada.

## Fase 4 — Subscriptions

Checkout Pro mensual/anual, webhooks firmados, deduplicación, activación y conciliación al volver ya están implementados. Pendiente: débito recurrente autorizado, contratos/promociones avanzados, períodos de gracia y conciliación operativa programada. Feature flags por organización/usuario/beta. No considerar los nombres de features como implementación de funcionalidades futuras.

## Fase 5 — Analytics

Reportes por período, productos y margen bruto estimado ya están implementados. Pendiente: comparación de períodos, widgets, objetivos y métricas por sucursal/empleado. Diferenciar flujo de caja, facturación y resultado contable.

## Fase 6 — Automation

Eventos de dominio + outbox + workers; triggers/conditions/actions validados, cuotas atómicas, límites de recursión, historial de ejecución y reintentos idempotentes.

## Fase 7 — AI

AIProvider/AIGateway, contexto de organización, herramientas autorizadas, cuotas, protección de datos y confirmación de acciones destructivas. Sin promesas de predicciones ni acceso transversal.

## Fase 8 — Integraciones

API keys con scopes y rotación, webhooks HMAC, entregas/reintentos, SSRF protection, adaptadores de ecommerce y fiscal según contrato. Cualquier integración con aplicaciones privadas NUBRA es exclusivamente interna.

## Fase 9 — Hardening y lanzamiento

MFA obligatorio de personal, pentest, rate limiting en ingress, control de payload global, observabilidad, métricas, alertas, performance, ensayo de restauración, rol DML, backups y retención acordada. Revisión jurídica real de documentos y proceso de derechos. Los textos actuales conservan LEGAL_REVIEW_REQUIRED.

## Próximo bloque recomendado

MFA/recuperación de personal, reaceptación legal y notificaciones mediante outbox. Para producto: compras/recepción, devoluciones de ventas cobradas e importación validada. Consultar [propuestas](FEATURE_IDEAS.md) y [estado vigente](../project-status.md).
