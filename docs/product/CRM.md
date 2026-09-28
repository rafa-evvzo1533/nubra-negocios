# CRM inicial

Clientes y leads iniciales comparten `customers.status` (LEAD/ACTIVE/INACTIVE). CRUD real, búsqueda, paginación, email, teléfono, notas y próximo contacto; timeline con NOTE/CALL/MEETING/EMAIL en `customer_activities`. Cada consulta usa contexto de organización y permisos del backend.

No se implementa todavía el pipeline de oportunidades, segmentos, archivos, etiquetas ni timeline unificado con cobros. Clientes relacionados con documentos comerciales no se borran accidentalmente: las claves externas impiden la eliminación. Exportación CSV protegida disponible por API; importación y mapeo CSV pendientes.
