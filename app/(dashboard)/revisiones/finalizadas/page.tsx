// Pantalla /revisiones/finalizadas: campañas finalizadas donde fuiste revisor.
// Solo monta CampaignList.tsx con completed = true.

import CampaignList from "../CampaignList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revisiones finalizadas" };

export default function RevisionesFinalizadasPage() {
  return <CampaignList completed />;
}
