# Backup y restauración

## Backup

Usar `pg_dump` desde un entorno seguro, con la URL de conexión inyectada por el gestor de secretos:

```bash
pg_dump --format=custom --file=nubra-negocios-YYYYMMDD.dump "$DATABASE_URL"
```

Guardar el archivo cifrado, con retención definida y prueba periódica de restauración. No incluir contraseñas en comandos versionados, logs o documentación operativa pública.

## Restauración

Restaurar primero en una base aislada, aplicar migraciones pendientes y ejecutar smoke tests de login, aislamiento por organización y operaciones transaccionales antes de cambiar tráfico:

```bash
createdb nubra_negocios_restore
pg_restore --dbname=nubra_negocios_restore nubra-negocios-YYYYMMDD.dump
npm run migrate
npm run typecheck
npm run test:integration
```

La restauración productiva requiere autorización explícita y ventana operativa. Los certificados fiscales y secretos deben recuperarse desde su gestor de secretos, no desde el dump.
## Política operativa a acordar antes del lanzamiento

Objetivo propuesto: backups diarios cifrados, recuperación a un punto en el tiempo cuando lo permita el proveedor, retención de 30 días y ensayo de restauración mensual. RPO/RTO, retención definitiva y excepciones por contrato deben acordarse y comprobarse; no se presentan como SLA vigente. Versionar objetos cuando se incorpore S3, conservar manifiestos/checksums y ensayar restauración coordinada de referencias SQL y objetos.

La suite nueva npm run test:all crea su propia base aislada; no sustituye el ensayo contra una copia restaurada ni debe ejecutarse como procedimiento de recuperación productiva. No se agregaron scripts de restauración destructiva.
