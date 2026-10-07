// Envío de correos con Gmail (nodemailer). Lo usan la verificación del correo
// (lib/verification.ts) y la recuperación de contraseña (lib/usuarios/recuperacion.ts).

import nodemailer from "nodemailer";

function getMailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = String(process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("GMAIL_USER o GMAIL_APP_PASSWORD no están configuradas");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function enviarCorreo(para: string, asunto: string, html: string) {
  await getMailTransport().sendMail({
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to: para,
    subject: asunto,
    html,
  });
}

/** Escapa texto escrito por el usuario (p. ej. su nombre) antes de meterlo al HTML del correo. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
