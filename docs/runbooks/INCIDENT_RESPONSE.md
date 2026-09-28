# Respuesta a incidentes

Responsables y contactos de guardia deben definirse antes de publicar el servicio. Esta guía no sustituye un equipo operativo ni configura alertas automáticas.

1. Abrir registro con hora, sistemas e indicadores; preservar logs y evidencia con acceso restringido. No copiar datos privados a tickets públicos.
2. Contener según evidencia: suspender organización afectada, revocar sesiones/grants, deshabilitar integración o bloquear ingress. Evitar borrados de evidencia.
3. Rotar credenciales comprometidas con identidades separadas: runtime SQL, staff, SMTP, Mercado Pago, firma de archivos y proveedor de claves. Rotar sesiones también cuando se sospeche exposición del navegador.
4. Determinar alcance por empresa, recursos, actor y ventana temporal; separar exposición de metadatos de exposición de contenido. No prometer ausencia de afectación sin evidencia.
5. Reparar y comprobar con tests de aislamiento, concurrencia y autenticación; restaurar en entorno aislado si hace falta. Validar recuperación y claves antes de reabrir.
6. Coordinar notificaciones contractuales/regulatorias con responsables legales según los hechos y jurisdicciones; no inventar plazos universales.
7. Documentar causa, evidencia, impacto, recuperación y acciones con responsables/fechas. Revisar permisos y monitoreo.

El acceso de emergencia está deshabilitado; un incidente no concede un bypass silencioso desde la UI.
