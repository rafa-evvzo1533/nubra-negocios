# Migraciones SQL

Las migraciones viven en `migrations/` y se aplican en orden lexicográfico mediante:

```bash
npm run migrate
```

El runner crea `schema_migrations`, ejecuta cada archivo dentro de una transacción y registra la versión aplicada. No usar `db push` sobre una base compartida ni editar manualmente una migración ya aplicada.

`ensureFoundationSchema()` solo verifica la última versión requerida. No crea tablas. La migración 0000 conserva el esquema existente y permite instalar desde una base vacía. El runner toma un advisory lock de transacción para serializar despliegues simultáneos. Nunca modificar archivos ya aplicados: agregar una nueva migración.

## Permisos

El usuario de ejecución de la aplicación debe tener permisos DML sobre tablas necesarias, pero no permisos de creación/alteración de esquema en producción. El runner de migraciones debe ejecutarse con un rol de despliegue separado.
