// Pantalla /revisiones: campañas en curso donde eres revisor aceptado.
// Desde el 2026-11-13 (a pedido del usuario) arriba va el dashboard del revisor (components/revisiones/
// DashboardDelRevisor), armado aquí en el servidor con obtenerDashboardDelRevisor() (lib/revisiones/dashboard.ts);
// si falla o la persona aún no revisa ninguna campaña, solo sale la lista. La lista la carga CampaignList.tsx.
// Acceso: sesión de usuario (exigirUsuario); el permiso por campaña lo revisa cada consulta.

import CampaignList from "./CampaignList";
import DashboardDelRevisor from "@/components/revisiones/DashboardDelRevisor";
import { obtenerDashboardDelRevisor } from "@/lib/revisiones/dashboard";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revisiones" };

export default async function RevisionesPage() {
  const usuario = await exigirUsuario();
  const datos = await obtenerDashboardDelRevisor(usuario.id);
  return <CampaignList resumen={datos && datos.campanas > 0 ? <DashboardDelRevisor datos={datos} /> : null} />;
}
