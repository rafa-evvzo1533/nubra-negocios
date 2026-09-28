# Comparación funcional con nubra-comercio-main

Revisión del proyecto local `../nubra-comercio-main`: `app.js`, `server.js`, HTML, estilos, manifiesto, service worker y documentación. No se importaron sus datos ni backups y no se copió su diseño.

| Función de referencia | Resultado en Nubra Negocios |
| --- | --- |
| Carrito con cobro completo/parcial | Agregada Venta rápida con stock, venta y cobro atómicos |
| Proveedores | Agregado CRUD y archivado con permisos y RLS |
| Costo, categoría, unidad y proveedor del producto | Incorporados al catálogo; costo histórico en ventas nuevas |
| Deudas de clientes y cobros | Agregada Cuenta corriente derivada de ventas/pagos, con distribución FIFO |
| Reportes de ventas y margen | Incorporados por período y medio de cobro |
| Auditoría | Pantalla de eventos del negocio sobre la auditoría existente |
| Clientes, productos, inventario, ventas y caja | Ya existían; se preservaron y reutilizaron |
| Configuración de negocio | Ya existe en el modelo y administración |
| Reemplazo completo de estado desde JSON | No incorporado: omite garantías del SaaS y puede destruir historial; importación validada queda en roadmap |
| Instalación PWA y trabajo local | Pendiente; requiere una política explícita para datos privados y reconciliación |

El servidor de referencia guarda un estado compartido. Se reutilizó su alcance funcional como referencia, manteniendo PostgreSQL, autenticación, permisos, transacciones y separación por negocio de la aplicación actual.
