# Base de datos y diseño de dominio

## Fuente operativa

PostgreSQL y migraciones SQL versionadas; pg es el cliente activo. prisma/schema.prisma es un diseño parcial heredado: no usar Prisma db push contra esta base. Las migraciones conservan tablas y registros existentes. El runtime verifica schema_migrations y no ejecuta DDL.

| Migración | Contenido |
| --- | --- |
| 0000_baseline.sql | Esquema existente extraído del inicializador; aditivo e idempotente para bases previas |
| 0001_security_and_fiscal_foundation.sql | Recuperación, rate limiting y tablas fiscales previas |
| 0002_operations.sql | Estado activo, comprobantes, pagos, caja y movimientos previos |
| 0003_saas_foundation.sql | Identidad interna, verificación, solicitudes, planes, capacidades, legal, RBAC, idempotencia e historial de stock |
| 0004_legal_drafts.sql | Versiones iniciales de términos y privacidad con LEGAL_REVIEW_REQUIRED |

Las tablas usan UUID y timestamps donde corresponde; relaciones empresariales incluyen organization_id. Clientes/productos/ventas/quotes/pagos y líneas usan claves compuestas. Sesiones guardan hash de token; tokens de email y recuperación tienen expiración y marca de uso. Nunca se almacenan contraseñas, enlaces de verificación ni secretos en auditoría.

## Foundation operativa

users → sessions; users → organization_applications (una solicitud por usuario en este bloque). Aprobación crea organizations + organization_members OWNER. staff_users → sesiones internas y plataforma de auditoría; las decisiones conservan reviewed_by/reviewed_at. Estados de solicitud: DRAFT, PENDING, UNDER_REVIEW, NEEDS_INFORMATION, APPROVED, REJECTED, SUSPENDED, BLOCKED. Empresa operativa: APPROVED/SUSPENDED/BLOCKED y active compatible con módulos anteriores.

plans → plan_entitlements ← features; organizations → subscriptions (una actual), subscription_history, usage_records, upgrade_requests. La cuota mensual se identifica por organización/feature/período UTC. Las capacidades de existencia (usuarios/clientes/productos) cuentan registros vivos bajo bloqueo de organización.

legal_documents → legal_document_versions → legal_acceptances vincula usuario/solicitud/empresa/fecha. Índice parcial asegura una sola versión vigente por documento. roles → role_permissions ← permissions implementa matriz de lectura/escritura. Auditoría empresarial y de plataforma son tablas separadas; plataforma no duplica contenido sensible de clientes.

## Core operativo

customers/customer_activities; products/inventory_movements; sales/sale_items; quotes/quote_items; payments/cash_sessions/cash_movements. Importes en centavos enteros, restricciones de stock no negativo y comprobantes con deduplicación. sales contiene idempotency_key + request_hash únicos por organización y estado CONFIRMED/CANCELLED. inventory_movements conserva cantidades anterior/nueva, actor y referencia para movimientos nuevos. Ver INVENTORY.md y CASH.md.

## Modelo final por fases (diseñado, aún no migrado)

| Dominio | Entidades previstas y relaciones |
| --- | --- |
| CRM | Customer, CustomerActivity, Lead → Customer opcional; Opportunity → PipelineStage → Pipeline; responsable → OrganizationMember; Tag/CustomerTag y segmentos |
| Catálogo | Product → Category, Supplier opcional; ProductVariant → Product; precios/costos/impuestos y unidad; servicios sin stock |
| Inventario | Branch → Warehouse → Inventory; InventoryItem único por organization/warehouse/variant; InventoryMovement con tipo, before/delta/after; StockAdjustment y StockTransfer con origen/destino de la misma empresa |
| Ventas | Sale → Customer/Branch/Member/CashRegister; SaleItem con snapshot de precio/impuesto/costo; Payment con clave idempotente; Refund con reversión explícita |
| Caja/finanzas | CashRegister → CashSession → CashMovement; Income/Expense → FinanceCategory/PaymentMethod; conciliación y saldos calculados sin llamar ganancia al cash flow |
| Presupuestos/compras | Quote → QuoteItem; Supplier → Purchase → PurchaseItem; recepción parcial crea movimiento de stock; pedidos como documento separado |
| Trabajo | Task con responsable/creador y relaciones CRM; Event; Notification por usuario y empresa; TaskChecklist |
| Automatización | Automation → AutomationTrigger/Condition/Action; DomainEvent/Outbox; AutomationRun con idempotency key y cuota consumida |
| Plataforma | OrganizationRole para CUSTOM, invitations con hash y vencimiento; UsageLimit/Entitlement por organización; FeatureFlag/Target por plan, organización, usuario o beta |
| Integraciones/archivos | Integration; Webhook → WebhookDelivery; File con object key, checksum, MIME, estado cuarentena/limpio; claves API con scopes y hash |
| Operación NUBRA | AdminNote, Contract, SupportTicket; SubscriptionHistory; LegalAcceptance inmutable por versión; incidentes de acceso excepcional auditados |

Cada entidad empresarial nueva debe tener UUID, organization_id, created_at/updated_at, índices que comiencen por organización y claves externas compuestas. Soft delete se incorporará en registros maestros cuando haga falta preservar referencias; movimientos financieros y de stock son históricos inmutables y se corrigen por reversión. Ninguna tabla futura representa una función disponible hoy.

## Migración futura a Prisma

Introspeccionar una copia vacía migrada, revisar índices parciales/checks, conservar SQL para reglas no representables, generar cliente en una rama de migración y sustituir repositorios gradualmente con pruebas equivalentes. No mantener dos esquemas de escritura divergentes.
