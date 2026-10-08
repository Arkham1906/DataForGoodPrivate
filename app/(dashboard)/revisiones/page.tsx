// Pantalla /revisiones: campañas en curso donde eres revisor aceptado.
// Solo monta CampaignList.tsx, que carga los datos.

import CampaignList from "./CampaignList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revisiones" };

export default function RevisionesPage() {
  return <CampaignList />;
}
