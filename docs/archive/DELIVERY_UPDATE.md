# Actualización · diseño, negocios, equipo y pagos

Se corrigió la causa de `/admin` sin estilos: un proceso de producción estaba sirviendo chunks reemplazados por un build posterior. Se reinició el servicio local como desarrollo y se separó `.next-dev` de `.next`. ESLint y Git ignoran ambos artefactos. El servidor local queda en http://localhost:3000.

## Dónde encontrar las funciones

- **Registrar negocio**: navegación pública y menú del workspace, `/register-business`. Cuenta → verificación por email → formulario → solicitud → aprobación por NUBRA.
- **Equipo y roles**: el propietario crea roles con permisos por módulo, los asigna a miembros e invita personas por correo. Los roles y sus permisos están aislados por empresa. Las invitaciones son revocables, vencen en 7 días y respetan la capacidad del plan.
- **Planes y beneficios**: `/plans`, comparación pública con beneficios y precios reales del catálogo.
- **Planes y suscripción**: `/settings/subscription`, vigencia, consumo, contratación por Mercado Pago, consultas e historial.
- **Precios configurables**: `/internal` → Planes, importe en ARS y habilitación individual de compra. Inicialmente sin precios ni cobros habilitados.

## Mercado Pago

Checkout Pro para Argentina, pago único de 30 días, renovación manual. No se implementó débito automático. La activación exige un webhook firmado y consulta del pago al proveedor; se valida cuenta vendedora, ambiente, importe, moneda y pedido. Eventos repetidos no duplican beneficios. No se hicieron cobros ni llamadas de pago a cuentas reales.

Se requieren las credenciales de Mercado Pago, URL pública/webhook y precios para cobrar; SMTP para correos. Instrucciones completas en [SUBSCRIPTIONS.md](../integrations/SUBSCRIPTIONS.md) y variables en `.env.example`. El simulador existe únicamente en el harness de pruebas, nunca en las rutas de producción. La prueba de homologación con una cuenta real de prueba del proveedor sigue pendiente de esas credenciales.

## Validación

Migraciones 0005 y 0006 aplicadas sin eliminar datos. Compilación de producción, TypeScript y ESLint correctos. Suite aislada completa: 91 comprobaciones foundation, 82 nuevas de roles/invitaciones/pagos/visual, 144 de integración, 64 de operaciones, 3 unitarias CSV y escenarios de navegador incluidos OCR. Se revisaron capturas de administración, registro, planes, equipo y suscripción; también planes en celular. PostgreSQL, SMTP local y proveedor de pagos simulado; la base temporal se elimina al terminar.

No se cambiaron credenciales existentes ni se publicaron cambios. Se preservó el trabajo que ya existía en el repositorio.
