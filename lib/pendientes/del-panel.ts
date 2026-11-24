// Pendientes del SuperUsuario (2026-11-24, a pedido del usuario): una sola fuente para la pantalla /sistema/pendientes,
// el recuadro azul del menú lateral del panel (lib/sistema/aviso-del-menu.ts) y el número junto a "Pendientes".
// Cada pendiente por separado, con su espera y su urgencia (lib/pendientes/tipos.ts):
//   - Supervisión: campañas en revisión sin supervisor o a su cargo (las de /supervisar), decisiones de datos abiertos
//     de esas campañas y, si no hay ningún supervisor, asignar uno.
//   - Moderación: reportes pendientes (un renglón, con el más antiguo) y cada apelación por resolver.
//   - Aportes sin revisar: campañas con aportes que esperan revisión hace más de DIAS_DE_ESPERA_DE_UN_APORTE días
//     (los revisa el creador o su revisor; el SuperUsuario los ve en la bandeja).
//   - Temáticas y subtemáticas propuestas, cada una.
// También es la fuente de "Requiere atención" de /sistema (2026-11-24): lib/sistema/resumen.ts los agrupa por `tipo`.

import { pool } from "@/lib/db";
import { listarApelacionesDelPanel } from "@/lib/apelaciones/apelaciones";
import { listarTickets } from "@/lib/tickets/consultas";
import { tituloDeDecision } from "@/lib/apelaciones/reglas";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import {
  DIAS_DE_ESPERA_DE_UN_APORTE,
  diasDesde,
  haceCuanto,
  ordenarPendientes,
  plural,
  urgenciaPorEspera,
  type Pendiente,
  type Urgencia,
} from "@/lib/pendientes/tipos";

const nombre = (name: string) => `«${name.trim()}»`;
const iso = (fecha: Date | string | null | undefined) => (fecha ? new Date(fecha).toISOString() : undefined);
const alMenosPronto = (u: Urgencia): Urgencia => (u === "normal" ? "pronto" : u);

async function deSupervision(): Promise<Pendiente[]> {
  const { rows } = await pool.query<{ tipo: "supervisar" | "datos" | "sin_supervisores"; id: number; name: string; desde: Date | null }>(
    `SELECT 'supervisar' AS tipo, id, name, COALESCE(en_revision_desde, updated_at) AS desde FROM campanas
      WHERE status = 'en_revision' AND (supervisado_por_root OR supervisor_id IS NULL)
     UNION ALL
     SELECT 'datos', c.id, c.name, c.updated_at FROM campana_datos_abiertos d JOIN campanas c ON c.id = d.campana_id
      WHERE d.estado = 'pendiente' AND (c.supervisado_por_root OR c.supervisor_id IS NULL)
     UNION ALL
     SELECT 'sin_supervisores', 0, '', NULL
      WHERE NOT EXISTS (SELECT 1 FROM usuario_roles WHERE rol = 'supervisor')`,
  );
  return rows.map((r): Pendiente => {
    const dias = diasDesde(r.desde);
    if (r.tipo === "sin_supervisores") {
      return {
        clave: "sin-supervisores",
        tipo: "sin_supervisores",
        seccion: "supervision",
        texto: "Asignar al menos un supervisor",
        href: "/usuarios",
        urgencia: "urgente",
        detalle: "No hay ninguno: todas las campañas nuevas te esperan a ti",
      };
    }
    if (r.tipo === "supervisar") {
      return {
        clave: `supervisar-${r.id}`,
        tipo: "supervisar",
        seccion: "supervision",
        texto: `Supervisar ${nombre(r.name)}`,
        href: `/supervisar/${r.id}`,
        urgencia: alMenosPronto(urgenciaPorEspera(dias)),
        detalle: `En revisión desde ${haceCuanto(dias)}: no recibe aportes hasta que se acepte`,
        desde: iso(r.desde),
      };
    }
    return {
      clave: `datos-${r.id}`,
      tipo: "datos",
      seccion: "supervision",
      texto: `Decidir los datos abiertos de ${nombre(r.name)}`,
      href: `/supervisar/${r.id}`,
      urgencia: urgenciaPorEspera(dias),
      detalle: `Finalizada ${haceCuanto(dias)}`,
      desde: iso(r.desde),
    };
  });
}

async function deModeracion(): Promise<Pendiente[]> {
  const [reportes, apelaciones] = await Promise.all([contarReportesPendientes(), listarApelacionesDelPanel("pendientes")]);
  const lista: Pendiente[] = apelaciones.map((a) => {
    const dias = diasDesde(a.creadaEn);
    return {
      clave: `apelacion-${a.id}`,
      tipo: "apelaciones",
      seccion: "moderacion",
      texto: `Responder la apelación de ${a.persona.nombre}: ${tituloDeDecision(a.decision)}`,
      href: "/apelaciones",
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `La envió ${haceCuanto(dias)}`,
      desde: iso(a.creadaEn),
    };
  });
  if (reportes.reportes > 0) {
    const dias = diasDesde(reportes.masViejo);
    lista.push({
      clave: "reportes",
      tipo: "reportes",
      cantidad: reportes.reportes,
      casos: reportes.casos,
      seccion: "moderacion",
      texto: `Resolver ${plural(reportes.reportes, "reporte", "reportes")} en ${plural(reportes.casos, "caso", "casos")}`,
      href: "/supervisar/reportes",
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `El más antiguo llegó ${haceCuanto(dias)}`,
      desde: iso(reportes.masViejo),
    });
  }
  return lista;
}

async function deAportesSinRevisar(): Promise<Pendiente[]> {
  const { rows } = await pool.query<{ id: number; name: string; esperando: number; desde: Date }>(
    `SELECT c.id, c.name, COUNT(*)::int AS esperando, MIN(a.submitted_at) AS desde
       FROM aportes a JOIN campanas c ON c.id = a.campaign_id
      WHERE a.status IN ('pendiente', 'espera_final') AND a.submitted_at < NOW() - make_interval(days => $1)
      GROUP BY c.id, c.name`,
    [DIAS_DE_ESPERA_DE_UN_APORTE],
  );
  return rows.map((r) => {
    const dias = diasDesde(r.desde);
    return {
      clave: `aportes-${r.id}`,
      tipo: "aportes",
      cantidad: r.esperando,
      seccion: "aportes",
      texto: `${nombre(r.name)}: ${plural(r.esperando, "aporte espera", "aportes esperan")} revisión`,
      href: `/aportes?campana=${r.id}&etapa=pendientes`,
      urgencia: "pronto",
      detalle: `El más antiguo, desde ${haceCuanto(dias)}; los revisa el creador o su revisor`,
      desde: iso(r.desde),
    };
  });
}

async function deCatalogo(): Promise<Pendiente[]> {
  const { rows } = await pool.query<{ tipo: "tematica" | "subtematica"; id: number; nombre: string; de: string | null; desde: Date | null }>(
    `SELECT 'tematica' AS tipo, id, nombre, NULL AS de, created_at AS desde FROM tematicas WHERE NOT aprobada AND NOT oculta
     UNION ALL
     SELECT 'subtematica', e.id, e.nombre, t.nombre, e.created_at FROM etiquetas e JOIN tematicas t ON t.id = e.tematica_id
      WHERE NOT e.aprobada`,
  );
  return rows.map((r) => {
    const dias = diasDesde(r.desde);
    return {
      clave: `${r.tipo}-${r.id}`,
      tipo: r.tipo === "tematica" ? "tematicas" : "subtematicas",
      seccion: "catalogo",
      texto:
        r.tipo === "tematica"
          ? `Revisar la temática propuesta ${nombre(r.nombre)}`
          : `Revisar la subtemática propuesta ${nombre(r.nombre)} de ${r.de ?? "su temática"}`,
      href: "/sistema/tematicas",
      urgencia: urgenciaPorEspera(dias),
      detalle: `Propuesta ${haceCuanto(dias)}`,
      desde: iso(r.desde),
    };
  });
}

/** Tickets de supervisores (2026-11-24): cada uno, con lo que pidió; esperan su decisión final. */
async function deTickets(): Promise<Pendiente[]> {
  const tickets = await listarTickets("pendientes");
  return tickets.map((t) => {
    const dias = diasDesde(t.creadoEn);
    const sobre = t.persona ? t.persona.nombre : t.campana ? nombre(t.campana.nombre) : "";
    return {
      clave: `ticket-${t.id}`,
      tipo: "tickets",
      seccion: "tickets",
      texto: `Decidir el ticket de ${t.supervisor.nombre}: ${t.pedido.toLowerCase()}${sobre ? ` para ${sobre}` : ""}`,
      href: "/tickets",
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `Lo pidió ${haceCuanto(dias)}; no se aplica hasta que lo apruebes`,
      desde: iso(t.creadoEn),
    };
  });
}

/** Los pendientes del SuperUsuario, de lo más urgente a lo menos. Puede lanzar: quien la llama decide qué mostrar. */
export async function pendientesDelPanel(): Promise<Pendiente[]> {
  const grupos = await Promise.all([deTickets(), deSupervision(), deModeracion(), deAportesSinRevisar(), deCatalogo()]);
  return ordenarPendientes(grupos.flat());
}
