// Pantalla /supervision/[campaignId]/panel: métricas de una campaña que supervisas.
// Server Component. Datos: obtenerPanelDeCampana() de lib/campanas/panel.ts, solo si supervisor_id eres tú.

import { notFound, redirect } from "next/navigation";
import PanelDeCampanaSupervisor from "@/components/supervision/PanelDeCampanaSupervisor";
import { obtenerPanelDeCampana } from "@/lib/campanas/panel";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panel de la campaña supervisada" };

export default async function SupervisedCampaignPanel({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const user = await exigirUsuario();
  if (!user.role.includes("supervisor")) redirect("/campanas");
  if (!/^\d+$/.test(campaignId)) notFound();

  // Solo el supervisor que tomó la campaña ve su panel.
  const acceso = await pool.query(`SELECT 1 FROM campanas WHERE id = $1 AND supervisor_id = $2 LIMIT 1`, [
    campaignId,
    user.id,
  ]);
  if (acceso.rowCount === 0) notFound();

  const panel = await obtenerPanelDeCampana(campaignId);
  if (!panel) notFound();

  return (
    <PanelDeCampanaSupervisor
      panel={panel}
      volverHref={`/supervision/${campaignId}`}
      volverTexto="Volver al detalle de campaña"
    />
  );
}
