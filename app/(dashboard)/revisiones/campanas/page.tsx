// Pantalla /revisiones/campanas (2026-11-13, a pedido del usuario): la pestaña "Campañas" del revisor de aportes,
// con las campañas en curso donde es revisor aceptado (CampaignList.tsx). Hasta ese día era /revisiones, que ahora
// es el dashboard. Las finalizadas siguen en /revisiones/finalizadas, dentro de la misma pestaña.
// La ficha de cada campaña es /revisiones/campanas/[campaignId].
// Acceso: sesión de usuario (exigirUsuario); el permiso por campaña lo revisa GET /api/revisiones.

import type { Metadata } from "next";
import CampaignList from "../CampaignList";
import { exigirUsuario } from "@/lib/session";

export const metadata: Metadata = { title: "Campañas · Revisiones" };

export default async function CampanasDelRevisorPage() {
  await exigirUsuario();
  return <CampaignList />;
}
