// GET /api/campanas/[id]/recoleccion-diaria — aportes recibidos en el tiempo y por tipo para las gráficas del panel.
// Solo el creador de la campaña (es su panel: /mis-campanas/[id]/panel). Desde el 2026-11-22 la serie va por hora, día,
// semana, mes o año del periodo pedido (?periodo=hoy|semana|mes|anio|historico, o ?desde=&hasta=; este mes por
// defecto; el histórico empieza el día de inicio de la campaña): lib/series-de-tiempo.ts.

import { NextResponse } from "next/server";
import { normalizeCampaignDate } from "@/lib/campaign-date";
import { pool } from "@/lib/db";
import { ultimaActualizacionDeCampana } from "@/lib/campanas/panel";
import { columnaDeTipos } from "@/lib/campanas/tipos-de-campana";
import { getSessionUser } from "@/lib/session";
import { periodoDesde } from "@/lib/periodo";
import { serieDeTiempo } from "@/lib/series-de-tiempo";

const ETIQUETA_DE_TIPO: Record<string, string> = {
  texto: "Texto",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
};

// Cuántos aportes (cualquier estado) se enviaron en cada día, semana, mes o año del periodo (`serie`), para la
// gráfica "Aportes recibidos" del panel de campaña, y los aprobados por tipo (`porTipo`).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    // Antes solo pedía sesión: cualquiera veía la actividad diaria de cualquier campaña.
    const dueno = await pool.query<{ creator_id: number; start_date: unknown }>(
      `SELECT creator_id, start_date FROM campanas WHERE id = $1`,
      [id],
    );
    if (dueno.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(dueno.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña ve sus estadísticas" }, { status: 403 });
    }

    const consulta = new URL(request.url).searchParams;
    const periodo = periodoDesde(
      { periodo: consulta.get("periodo") ?? undefined, desde: consulta.get("desde") ?? undefined, hasta: consulta.get("hasta") ?? undefined },
      "mes",
    );

    const [serie, tipoResult, campanaResult] = await Promise.all([
      // Igual que lib/campanas/panel.ts: días de Tepic.
      serieDeTiempo({
        fuente: `SELECT submitted_at AS t, 'aportes' AS s FROM aportes WHERE campaign_id = $1`,
        parametros: [id],
        series: ["aportes"],
        periodo,
        inicioHistorico: normalizeCampaignDate(dueno.rows[0].start_date),
      }),
      // Base de "aportes aprobados", igual que el MetricCard de arriba del
      // panel: es la pregunta que responde esta sección ("¿de qué tipo son
      // los aportes que ya se aceptaron?"), no de todo lo enviado.
      pool.query<{ file_type: string; n: string }>(
        `SELECT file_type, COUNT(*) AS n FROM aportes WHERE campaign_id = $1 AND status = 'aceptado' GROUP BY file_type`,
        [id]
      ),
      pool.query<{ data_types: string[] }>(`SELECT ${columnaDeTipos()} FROM campanas WHERE id = $1 LIMIT 1`, [id]),
    ]);

    const conteoPorTipo = new Map(tipoResult.rows.map((r) => [r.file_type, Number(r.n)]));
    const tiposDeLaCampana = Array.isArray(campanaResult.rows[0]?.data_types) ? campanaResult.rows[0].data_types : [];
    const totalAprobados = tipoResult.rows.reduce((suma, r) => suma + Number(r.n), 0);
    const porTipo = tiposDeLaCampana.map((tipo) => {
      const valor = conteoPorTipo.get(tipo) ?? 0;
      return {
        tipo,
        etiqueta: ETIQUETA_DE_TIPO[tipo] ?? tipo,
        valor,
        porcentaje: totalAprobados > 0 ? Math.round((valor / totalAprobados) * 100) : 0,
      };
    });

    return NextResponse.json({ serie, periodo, porTipo, actualizadoEn: await ultimaActualizacionDeCampana(id) });
  } catch (error) {
    console.error("Error obteniendo la recolección diaria", error);
    return NextResponse.json({ error: "No se pudo obtener la recolección diaria" }, { status: 500 });
  }
}
