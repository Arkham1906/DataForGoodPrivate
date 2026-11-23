// Pantalla /supervisar/[campaignId]/panel: métricas de una campaña supervisada por el SuperUsuario.
// Server Component. Datos: obtenerCampanaSupervisadaPorRoot() y lib/campanas/panel.ts.
// Métricas generales (2026-10-27): lib/campanas/metricas-generales.ts. Periodo de la gráfica de recolección
// (2026-11-22): ?periodo= o ?desde=&hasta= (lib/periodo.ts), este mes por defecto.

import { notFound } from "next/navigation";
import PanelDeCampanaSupervisor from "@/components/supervision/PanelDeCampanaSupervisor";
import { obtenerPanelDeCampana } from "@/lib/campanas/panel";
import { periodoDesde } from "@/lib/periodo";
import { obtenerMetricasGenerales } from "@/lib/campanas/metricas-generales";
import { pool } from "@/lib/db";
import { exigirSesionRoot } from "@/lib/supervision/root";
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
  await exigirSesionRoot();
  if (!/^\d+$/.test(campaignId)) notFound();

  // Solo si la campaña la tomó el SuperUsuario.
  const acceso = await pool.query(`SELECT 1 FROM campanas WHERE id = $1 AND supervisado_por_root LIMIT 1`, [campaignId]);
  if (acceso.rowCount === 0) notFound();

  const [panel, metricasGenerales] = await Promise.all([obtenerPanelDeCampana(campaignId, periodo), obtenerMetricasGenerales(campaignId)]);
  if (!panel) notFound();

  return (
    <PanelDeCampanaSupervisor
      panel={panel}
      periodo={periodo}
      metricasGenerales={metricasGenerales}
      volverHref={`/supervisar/${campaignId}`}
      volverTexto="Volver al detalle de campaña"
    />
  );
}
