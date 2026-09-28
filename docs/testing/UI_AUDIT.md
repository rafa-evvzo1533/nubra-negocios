# Auditoría UI

Aplicación única Next App Router. Shell funcional en Workspace, módulos CRUD en BusinessModule/Composer/RecordDetail, caja/equipo en operations, público y suscripciones en foundation, administración en AdminView/InternalConsole. Dialog ya centraliza foco, Escape y bloqueo de scroll; conservarlo. Hay componentes heredados de dashboard/layout que también deben recibir tokens, sin inventar módulos inexistentes.

Problemas: paleta clara/verde, hex dispersos, texto demasiado pequeño, cards públicas sin producto visible, marca tipográfica reconstruida pese a `src/assets/images/nubranegocios.png`, avatar R redundante, alerta de mínimo confundida con stock real y navegación de admin poco clara. El catálogo real ya viene de PostgreSQL: no duplicar capacidades en marketing.

Intervención: tokens oscuros centralizados (#020307/#070912/#0B0E18), marca azul/violeta/cyan y colores funcionales; migrar CSS Modules existentes a tokens; logo oficial mediante Next Image; landing con módulos reales, flujo y FAQ; corregir stock y acceso admin; estados/forms/tables/dialogs compartidos. Conservar rutas, tests, Lucide, OCR local y operaciones. No añadir IA ni prometer SSO/HA/backups cloud todavía inexistentes.

Validación prevista: 1440,1280,1024,768,390,360; auth/onboarding/workspace/administración, CRUD y flujos sensibles en base temporal. Ver reporte final para resultados ejecutados.
