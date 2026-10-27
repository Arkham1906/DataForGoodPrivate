// GET /api/campanas/[id]/recoleccion-diaria — aportes por día y por tipo para las gráficas del panel.
// Solo el creador de la campaña (es su panel: /mis-campanas/[id]/panel).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const DIAS = 14;

const NOMBRE_DE_DIA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });

const ETIQUETA_DE_TIPO: Record<string, string> = {
  texto: "Texto",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
};

/** Últimos `dias` días (más antiguo primero), como clave "YYYY-MM-DD" + etiqueta corta. */
function diasRecientes(dias: number): { clave: string; etiqueta: string }[] {
  const hoy = new Date();
  const lista: { clave: string; etiqueta: string }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - i));
    lista.push({
      clave: fecha.toISOString().slice(0, 10),
      etiqueta: NOMBRE_DE_DIA.format(fecha).replace(".", ""),
    });
  }
  return lista;
}

// Cuántos aportes (cualquier estado) se enviaron cada día de los últimos 14,
// para la gráfica "Recolección diaria" del panel de campaña.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    // Antes solo pedía sesión: cualquiera veía la actividad diaria de cualquier campaña.
    const dueno = await pool.query<{ creator_id: number }>(`SELECT creator_id FROM campanas WHERE id = $1`, [id]);
    if (dueno.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(dueno.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña ve sus estadísticas" }, { status: 403 });
    }

    const dias = diasRecientes(DIAS);
    const desde = dias[0]?.clave ?? "1970-01-01";

    const [diariaResult, tipoResult, campanaResult] = await Promise.all([
      pool.query<{ dia: string; n: string }>(
        `SELECT to_char(date_trunc('day', submitted_at), 'YYYY-MM-DD') AS dia, COUNT(*) AS n
         FROM aportes
         WHERE campaign_id = $1 AND submitted_at >= $2::date
         GROUP BY 1`,
        [id, desde]
      ),
      // Base de "aportes aprobados", igual que el MetricCard de arriba del
      // panel: es la pregunta que responde esta sección ("¿de qué tipo son
      // los aportes que ya se aceptaron?"), no de todo lo enviado.
      pool.query<{ file_type: string; n: string }>(
        `SELECT file_type, COUNT(*) AS n FROM aportes WHERE campaign_id = $1 AND status = 'aceptado' GROUP BY file_type`,
        [id]
      ),
      pool.query<{ data_types: string[] }>(`SELECT data_types FROM campanas WHERE id = $1 LIMIT 1`, [id]),
    ]);

    const porDia = new Map(diariaResult.rows.map((r) => [r.dia, Number(r.n)]));
    const data = dias.map((d) => ({ fecha: d.clave, etiqueta: d.etiqueta, valor: porDia.get(d.clave) ?? 0 }));

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

    return NextResponse.json({ data, porTipo });
  } catch (error) {
    console.error("Error obteniendo la recolección diaria", error);
    return NextResponse.json({ error: "No se pudo obtener la recolección diaria" }, { status: 500 });
  }
}
