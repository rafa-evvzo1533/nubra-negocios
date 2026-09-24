import nodemailer from "nodemailer";
import { HttpError } from "./http";
export function mailConfig() {
  if (
    process.env.MAIL_ENABLED !== "true" ||
    !process.env.SMTP_HOST ||
    !process.env.MAIL_FROM ||
    !process.env.APP_URL
  )
    throw new HttpError(
      503,
      "La recuperación por correo todavía no está configurada. Contactá a Nubra.",
    );
  const base = new URL(process.env.APP_URL);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw new HttpError(503, "Configuración de correo inválida");
  return { base, host: process.env.SMTP_HOST, from: process.env.MAIL_FROM };
}
export async function sendResetEmail(email: string, token: string) {
  return sendTokenEmail(email, token, false);
}
export async function sendVerificationEmail(email: string, token: string) {
  return sendTokenEmail(email, token, true);
}
export async function sendInvitationEmail(email: string, token: string) {
  return sendTokenEmail(email, token, false, true);
}
async function sendTokenEmail(
  email: string,
  token: string,
  verification: boolean,
  invitation = false,
) {
  const { base, host, from } = mailConfig();
  const url = new URL(
    invitation ? "/invite" : verification ? "/verify-email" : "/reset-password",
    base,
  );
  url.hash = `token=${token}`;
  const local =
    process.env.MAIL_ALLOW_LOCAL_SMTP === "true" &&
    ["localhost", "127.0.0.1"].includes(host);
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    requireTLS: !local,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({
    from,
    to: email,
    subject: invitation
      ? "Te invitaron a un negocio en Nubra"
      : verification
        ? "Verificá tu email en Nubra Negocios"
        : "Recuperar acceso a Nubra Negocios",
    text: invitation
      ? `El propietario de un negocio te invitó a su equipo en Nubra. Creá o iniciá sesión con este mismo email y aceptá la invitación. Vence en 7 días.\n\n${url.toString()}\n\nSi no reconocés esta invitación, ignorala.`
      : verification
        ? `Verificá tu email para solicitar acceso a Nubra Negocios. El enlace vence en 24 horas y funciona una sola vez.\n\n${url.toString()}\n\nSi no creaste esta cuenta, ignorá este correo.`
        : `Recibimos una solicitud para cambiar tu contraseña. El enlace vence en 30 minutos y funciona una sola vez.\n\n${url.toString()}\n\nSi no lo solicitaste, podés ignorar este correo.`,
  });
}
