// /api/campanas/[id]/aporte-sin-cuenta — aporte SIN cuenta desde la ficha pública de la campaña
// (/participa/[id], a la que lleva "Aportar sin cuenta" de /campanas/[id]; 2026-11-11, a pedido del usuario).
// Público: no pide sesión. Mismas reglas que desde el enlace (lib/campanas/aportes-anonimos.ts: campaña
// activa que permita aportes sin cuenta, un aporte por dispositivo, tope de anónimos que elige el creador o el 10% de la meta), pero no usa
// el enlace del creador: el aporte va sin enlace_id y no cuenta en las visitas ni en los aportes del enlace.

import { responderAporteAnonimo } from "@/lib/campanas/aporte-anonimo-http";

// POST (multipart/form-data; campos y respuestas en lib/campanas/aporte-anonimo-http.ts).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return responderAporteAnonimo(request, { campanaId: Number(id) });
}
