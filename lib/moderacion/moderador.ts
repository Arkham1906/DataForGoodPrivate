// Quién modera (reportes y sanciones, 2026-10-13): el SuperUsuario desde /supervisar (sesión raíz)
// o un usuario con rol de supervisor desde /supervision. Antes era solo el SuperUsuario desde el panel.
// Las server actions reciben la zona y comprueban la sesión que le corresponde: así una acción
// hecha desde /supervision nunca queda a nombre del SuperUsuario aunque el navegador tenga las dos.

import { redirect } from "next/navigation";

import type { ActorDeAuditoria } from "@/lib/auditoria";
import { hasRootSession } from "@/lib/rootSession";
import { getSessionUser, exigirUsuario } from "@/lib/session";
import { ZONAS_DE_MODERACION, type ZonaDeModeracion } from "@/lib/moderacion/rutas";

export type Moderador = { tipo: "root" } | { tipo: "usuario"; usuarioId: number; nombre: string };

function nombreDe(u: { nombre: string; apellidos: string }): string {
  return `${u.nombre} ${u.apellidos}`.trim() || "Supervisor";
}

/** Para server actions: el moderador de esa zona, o null si la sesión no alcanza. */
export async function moderadorDe(zona: unknown): Promise<Moderador | null> {
  if (typeof zona !== "string" || !ZONAS_DE_MODERACION.has(zona)) return null;
  if (zona === "supervisar") return (await hasRootSession()) ? { tipo: "root" } : null;
  const u = await getSessionUser();
  if (!u || !u.role.includes("supervisor")) return null;
  return { tipo: "usuario", usuarioId: Number(u.id), nombre: nombreDe(u) };
}

/** Para páginas: sin la sesión de la zona, a /root o a /campanas (como sus layouts). */
export async function exigirModerador(zona: ZonaDeModeracion): Promise<Moderador> {
  if (zona === "supervisar") {
    if (!(await hasRootSession())) redirect("/root");
    return { tipo: "root" };
  }
  const u = await exigirUsuario();
  if (!u.role.includes("supervisor")) redirect("/campanas");
  return { tipo: "usuario", usuarioId: Number(u.id), nombre: nombreDe(u) };
}

export function actorDeModerador(m: Moderador): ActorDeAuditoria {
  return m.tipo === "root" ? { tipo: "superusuario" } : { tipo: "usuario", id: m.usuarioId };
}

/** Lo que se guarda en sanciones.aplicada_por (VARCHAR 120) y se ve en la lista de sanciones. */
export function firmaDeModerador(m: Moderador): string {
  return m.tipo === "root" ? "SuperUsuario" : `Supervisor: ${m.nombre}`.slice(0, 120);
}

/** El id de la cuenta del moderador (para que no se modere a sí mismo), o null si es el SuperUsuario. */
export function cuentaDelModerador(m: Moderador): number | null {
  return m.tipo === "usuario" ? m.usuarioId : null;
}
