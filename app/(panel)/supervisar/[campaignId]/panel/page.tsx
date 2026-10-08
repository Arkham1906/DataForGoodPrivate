// Pantalla /supervisar/[campaignId]/panel: métricas de una campaña supervisada por el SuperUsuario.
// Server Component. Datos: obtenerCampanaSupervisadaPorRoot() y lib/campanas/panel.ts.

import { notFound } from "next/navigation";
import PanelDeCampanaSupervisor from "@/components/supervision/PanelDeCampanaSupervisor";
import { obtenerPanelDeCampana } from "@/lib/campanas/panel";
import { pool } from "@/lib/db";
import { exigirSesionRoot } from "@/lib/supervision/root";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panel de la campaña supervisada" };

export default async function SupervisedCampaignPanel({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  await exigirSesionRoot();
  if (!/^\d+$/.test(campaignId)) notFound();

  // Solo si la campaña la tomó el SuperUsuario.
  const acceso = await pool.query(`SELECT 1 FROM campanas WHERE id = $1 AND supervisado_por_root LIMIT 1`, [campaignId]);
  if (acceso.rowCount === 0) notFound();

  const panel = await obtenerPanelDeCampana(campaignId);
  if (!panel) notFound();

  return (
    <PanelDeCampanaSupervisor
      panel={panel}
      volverHref={`/supervisar/${campaignId}`}
      volverTexto="Volver al detalle de campaña"
    />
  );
}
