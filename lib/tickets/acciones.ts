"use server";

// Server action de los tickets de supervisión (2026-11-24): solo el SuperUsuario los aprueba o rechaza, desde
// /tickets del panel. Lógica en ./resolver.ts.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { resolverTicket, type Resultado } from "./resolver";

export async function resolverTicketDelPanel(ticketId: string, aprobar: boolean, respuesta: string): Promise<Resultado> {
  if (!(await hasRootSession())) return { ok: false, error: "Tu sesión de SuperUsuario terminó. Vuelve a entrar." };
  const resultado = await resolverTicket(Number(ticketId), Boolean(aprobar), String(respuesta ?? ""));
  if (resultado.ok) {
    revalidatePath("/tickets");
    revalidatePath("/sistema", "layout");
    revalidatePath("/supervisar", "layout");
    revalidatePath("/supervision", "layout");
    revalidatePath("/usuarios", "layout");
  }
  return resultado;
}
