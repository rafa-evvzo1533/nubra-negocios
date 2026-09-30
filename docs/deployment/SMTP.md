# Correo para registro y recuperación

El registro público requiere SMTP real. Crear una cuenta no verifica el email ni
concede acceso al negocio; se mantienen la verificación de un solo uso y la
aprobación interna.

Configurar únicamente en el entorno privado:

```dotenv
MAIL_ENABLED=true
MAIL_ALLOW_LOCAL_SMTP=false
MAIL_FROM="Nubra Negocios <TU_CASILLA@TU_DOMINIO>"
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=TU_CASILLA@TU_DOMINIO
SMTP_PASSWORD="CONTRASENA_DE_LA_CASILLA"
```

Hostinger Email usa `smtp.hostinger.com`; Titan usa `smtp.titan.email`. La
contraseña corresponde a la casilla, no al acceso de hPanel. Usar los parámetros
que muestra la configuración de esa casilla. Puerto 465 usa TLS desde el inicio;
587 exige STARTTLS. El remitente debe estar autorizado por el proveedor.

En la VPS, estos valores se agregan a `/etc/nubra-negocios/runtime.env`
(root:root, modo 0600). Antes de reiniciar `nubra-negocios`, comprobar conexión,
TLS y autenticación con `nodemailer.verify()`. Esta verificación no envía un
correo ni prueba la entrega en la bandeja de entrada: el registro real debe
confirmar ese último paso. No registrar contraseñas ni enlaces de verificación.

Si el correo está deshabilitado o incompleto, `/register` avisa antes de pedir
datos. La API devuelve 503 sin crear cuentas ni consumir intentos de registro.
El formulario vuelve a habilitarse al configurar correo y reiniciar el servicio;
la disponibilidad se evalúa en cada solicitud, no durante el build.

Las credenciales nunca se escriben en `.env.example`. Si una clave real fue
publicada, sustituir la plantilla no elimina el valor de los commits anteriores:
rotar las credenciales afectadas. No cambiar un usuario PostgreSQL compartido con
otros proyectos sin coordinar la actualización de sus conexiones.

Referencias: [Hostinger Email](https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/),
[Titan Email](https://www.hostinger.com/support/5966022-how-to-get-email-account-configuration-details-for-titan-email).
