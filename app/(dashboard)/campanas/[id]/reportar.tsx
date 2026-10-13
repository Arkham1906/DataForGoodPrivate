"use client";

// "Reportar campaña" de /campanas/[id] (2026-10-12), con ui/ReportarAPlataforma y
// POST /api/campanas/[id]/reportar. El reporte llega a la bandeja del SuperUsuario (/reportes); quien
// creó la campaña no se entera ni sabe quién la reportó. Uno por persona y campaña.

import ReportarAPlataforma from "@/components/ui/ReportarAPlataforma";
import { MOTIVOS_DE_REPORTE_DE_CAMPANA } from "@/lib/reportes/motivos";

export default function ReportarCampana({ campanaId, yaReportada }: { campanaId: string; yaReportada: boolean }) {
  return (
    <ReportarAPlataforma
      url={`/api/campanas/${encodeURIComponent(campanaId)}/reportar`}
      motivos={MOTIVOS_DE_REPORTE_DE_CAMPANA}
      titulo="Reportar campaña"
      explicacion="Tu reporte lo revisa el equipo de DataForGood, que decide si da un aviso a quien la creó. Esa persona no sabrá quién la reportó."
      placeholder="Qué tiene de inapropiado o engañoso la campaña"
      yaReportado={yaReportada}
      textoYaReportado="Ya reportaste esta campaña. El equipo de DataForGood lo está revisando."
    />
  );
}
