"use server";

// Server actions de las apelaciones (2026-11-22, a pedido del usuario). Lógica en ./apelaciones.ts.
// - apelar: la persona, con su sesión aunque la cuenta esté suspendida o baneada (cuentaDeLaSesionAunqueBloqueada),
//   desde /mis-apelaciones o /cuenta-bloqueada.
// - resolverApelacionDelPanel: solo el SuperUsuario, desde /apelaciones del panel.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { cuentaDeLaSesionAunqueBloqueada } from "@/lib/session";
import { enviarApelacion, resolverApelacion, type Resultado } from "./apelaciones";

function revalidar() {
  revalidatePath("/mis-apelaciones");
  revalidatePath("/cuenta-bloqueada");
  revalidatePath("/apelaciones");
  revalidatePath("/sistema");
}

export async function apelar(clave: string, motivo: string): Promise<Resultado> {
  const cuenta = await cuentaDeLaSesionAunqueBloqueada();
  if (!cuenta) return { ok: false, error: "Tu sesión terminó. Vuelve a iniciar sesión para apelar." };
  const resultado = await enviarApelacion(cuenta.id, clave, motivo);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function resolverApelacionDelPanel(apelacionId: string, aceptar: boolean, respuesta: string): Promise<Resultado> {
  if (!(await hasRootSession())) return { ok: false, error: "Tu sesión de SuperUsuario terminó. Vuelve a entrar." };
  const resultado = await resolverApelacion(Number(apelacionId), Boolean(aceptar), respuesta);
  if (resultado.ok) revalidar();
  return resultado;
}
