// Pantalla /supervision/[campaignId]/panel: métricas de una campaña que supervisas.
// Server Component. Datos: obtenerPanelDeCampana() de lib/campanas/panel.ts, solo si supervisor_id eres tú.
// Métricas generales (2026-10-27): lib/campanas/metricas-generales.ts. Periodo de la gráfica de recolección
// (2026-11-22): ?periodo= o ?desde=&hasta= (lib/periodo.ts), este mes por defecto.

import { notFound, redirect } from "next/navigation";
import PanelDeCampanaSupervisor from "@/components/supervision/PanelDeCampanaSupervisor";
import { obtenerPanelDeCampana } from "@/lib/campanas/panel";
import { periodoDesde } from "@/lib/periodo";
import { obtenerMetricasGenerales } from "@/lib/campanas/metricas-generales";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panel de la campaña supervisada" };

export default async function SupervisedCampaignPanel({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const { campaignId } = await params;
  const periodo = periodoDesde(await searchParams, "mes");
  const user = await exigirUsuario();
  if (!user.role.includes("supervisor")) redirect("/campanas");
  if (!/^\d+$/.test(campaignId)) notFound();

  // Solo el supervisor que tomó la campaña ve su panel.
  const acceso = await pool.query(`SELECT 1 FROM campanas WHERE id = $1 AND supervisor_id = $2 LIMIT 1`, [
    campaignId,
    user.id,
  ]);
  if (acceso.rowCount === 0) notFound();

  const [panel, metricasGenerales] = await Promise.all([obtenerPanelDeCampana(campaignId, periodo), obtenerMetricasGenerales(campaignId)]);
  if (!panel) notFound();

  return (
    <PanelDeCampanaSupervisor
      panel={panel}
      periodo={periodo}
      metricasGenerales={metricasGenerales}
      volverHref={`/supervision/${campaignId}`}
      volverTexto="Volver al detalle de campaña"
    />
  );
}
