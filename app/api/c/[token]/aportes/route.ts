// /api/c/[token]/aportes — aporte SIN cuenta desde el enlace público de una campaña.
// Público: no pide sesión. Es lo único que una persona anónima puede hacer en el sistema,
// y solo con un enlace vigente de una campaña activa. Lo usa el formulario de /c/[token]
// (aporte-anonimo.tsx). Reglas y cuota en lib/campanas/aportes-anonimos.ts; la respuesta, igual que
// desde la ficha (POST /api/campanas/[id]/aporte-sin-cuenta), en lib/campanas/aporte-anonimo-http.ts.

import { responderAporteAnonimo } from "@/lib/campanas/aporte-anonimo-http";

// POST (multipart/form-data; campos y respuestas en lib/campanas/aporte-anonimo-http.ts). El aporte
// guarda enlace_id: cuenta como aporte recibido por el enlace.
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return responderAporteAnonimo(request, { token });
}
