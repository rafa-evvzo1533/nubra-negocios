# Auditoría inicial · 24 de septiembre de 2026

## Estado recibido

El árbol de trabajo ya tenía cambios sin commit y archivos nuevos. Se conservaron y extendieron; no se reinicializó el proyecto. Stack instalado: Next.js 16.3.5 / App Router, React 19.2.8, TypeScript strict, Zod 4, PostgreSQL/pg, CSS Modules, Tailwind 4, Nodemailer y Playwright. Se consultaron las guías incluidas en `node_modules/next/dist/docs` para rutas, cookies, autenticación y CSP.

Persistencia real existente: usuarios, sesiones, organizaciones, miembros, clientes, actividades, catálogo, stock, ventas, presupuestos, pagos, caja y comprobantes. APIs versionadas, búsqueda global, dashboard y navegación responsive. Adaptador fiscal incompleto, sin emisión productiva. Prisma instalado con un schema parcial sin cliente generado: no era el ORM activo.

## Brechas encontradas y abordadas

| Hallazgo | Cambio del bloque |
| --- | --- |
| Registro exclusivamente administrativo | Registro público → email → solicitud → revisión → workspace |
| Esquema creado en solicitudes HTTP; migraciones incompletas en base vacía | Baseline 0000 + migraciones explícitas con bloqueo transaccional |
| Credencial administrativa compartida en variables; sesiones sin actor | `staff_users`, contraseña derivada, roles internos, sesiones asociadas y auditoría |
| Sin planes ni suscripciones activas | Cuatro planes, capacidades, límites, fuente, vigencia e historial |
| Sin aceptación legal versionada | Documentos/versiones/aceptaciones y borradores editables por nueva migración |
| Venta directa sin idempotencia | Clave obligatoria, huella de contenido, bloqueo y respuesta estable |
| Sin cancelación de ventas | Cancelación de ventas sin pagos; restitución de stock una sola vez |
| Sin exportación aislada y medida | CSV por organización, permisos, consumo mensual y auditoría |
| Sin CSP ni headers de seguridad | Nonce por petición, CSP, anti-framing, referrer y MIME |
| Fuente de Google cargada automáticamente | Fuente de sistema sin petición a terceros |

## Decisión arquitectónica

Conservar el monolito modular y SQL parametrizado. Reemplazar `pg` por Prisma en el mismo bloque introduciría dos fuentes de verdad para stock y caja. La fuente operativa del esquema son las migraciones SQL. Antes de adoptar Prisma: introspección contra una base de prueba, representación de claves compuestas y restricciones, baseline sin `db push`, pruebas equivalentes y migración de repositorios por dominio. No introducir NestJS, Redis ni microservicios hasta justificar su necesidad.

## Límites de esta entrega

No es la totalidad del producto empresarial de 61 apartados. Implementa el flujo de foundation y extiende el core existente. Quedan pendientes MFA/2FA del personal, invitaciones por email, roles personalizados, depósitos/variantes, devoluciones con pagos, onboarding guiado posterior a aprobación, archivos S3/antivirus, automatizaciones, notificaciones persistentes, cobros externos, integración fiscal productiva y revisión jurídica. El dashboard existente no implementa aún todos los períodos comparativos solicitados.

La credencial local `ADMIN_PASSWORD` no supera la validación de aprovisionamiento (mínimo 12 caracteres); no se reemplazó ni imprimió. El registro necesita SMTP configurado. Las pruebas generan credenciales propias y usan SMTP local y una base temporal.
