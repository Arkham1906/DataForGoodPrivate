// Pendientes de una persona con cuenta (2026-11-24, a pedido del usuario): una sola fuente para la pantalla
// /pendientes, el recuadro azul del menú lateral (lib/usuarios/aviso-del-menu.ts) y el número junto a "Pendientes".
// Cada pendiente va por separado (una campaña por renglón, con su nombre y enlace directo), con cuánto lleva
// esperando o cuándo vence y su urgencia (lib/pendientes/tipos.ts). Secciones, de lo que bloquea a otros a lo demás:
//   - Supervisión (rol supervisor): campañas por dictaminar, reportes por resolver, datos abiertos por decidir y
//     pausadas por la supervisión que el creador ya ajustó (las reglas del dashboard de /supervision).
//   - Revisión: invitaciones de revisor sin responder (con el nombre de la campaña) y aportes por revisar, por campaña.
//   - Tus campañas: aportes por revisar, rechazadas por corregir, pausadas por la supervisión por ajustar, borradores
//     y, nuevo, las activas que cierran en 7 días sin llegar a su meta (para compartirlas).
//   - Aportar: cuota pendiente (lib/campanas/cuota-pendiente.ts, la regla del recordatorio semanal).
//   - Tus apelaciones: las que se respondieron en los últimos 7 días (nuevo).
//   - Tu perfil: sin temáticas de interés; sin ubicación.
// Aparte, una sugerencia que no cuenta como pendiente: una campaña activa que cierra pronto y necesita aportes.
// Sin el rol de creador no se le pide terminar borradores ni reenviar rechazadas; sin el de aportador, ni cuotas ni
// sugerencia (2026-11-22). La gamificación (misiones, racha) no entra (decisión del usuario del 2026-11-13).

import { pool } from "@/lib/db";
import { campanasConCuotaPendiente } from "@/lib/campanas/cuota-pendiente";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { ESTADOS_TERMINADOS } from "@/lib/campanas/terminada";
import { hoyEnTepic } from "@/lib/fecha-de-tepic";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import { zonaDetectadaDe } from "@/lib/ubicacion/zona-detectada";
import { sqlSinTicketDeDatos } from "@/lib/tickets/crear";
import type { SessionUser } from "@/lib/session";
import { puedeAportar, puedeCrearCampanas } from "@/lib/usuarios/rol-asignable";
import {
  DIAS_DE_CIERRE_PRONTO,
  cuandoCierra,
  diasDesde,
  haceCuanto,
  ordenarPendientes,
  plural,
  urgenciaPorCierre,
  urgenciaPorEspera,
  type Pendiente,
  type Urgencia,
} from "@/lib/pendientes/tipos";

/** Días que una respuesta a una apelación sigue en pendientes. */
const DIAS_DE_APELACION_RESPONDIDA = 7;
/** Campañas con cuota pendiente que se listan. */
const CUOTAS_EN_PENDIENTES = 20;

export type PendientesDelUsuario = {
  /** Ordenados de lo más urgente a lo menos (ordenarPendientes). */
  pendientes: Pendiente[];
  /** No cuenta como pendiente: una campaña que cierra pronto y necesita aportes. */
  sugerencia: Pendiente | null;
};

const nombre = (name: string) => `«${name.trim()}»`;
const iso = (fecha: Date | string | null | undefined) => (fecha ? new Date(fecha).toISOString() : undefined);
/** Al menos "pronto": lo que tiene a otra persona esperando. */
const alMenosPronto = (u: Urgencia): Urgencia => (u === "normal" ? "pronto" : u);

/** "2026-11-30" como instante (mediodía en UTC, para ordenar por fecha). */
const isoDeDia = (dia: string | null) => (dia ? `${dia}T12:00:00.000Z` : undefined);

function sumarDias(dia: string, dias: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

async function deSupervisor(usuarioId: number): Promise<Pendiente[]> {
  const [{ rows }, reportes] = await Promise.all([
    pool.query<{ tipo: "dictaminar" | "datos" | "reanudar"; id: number; name: string; desde: Date | null }>(
      `SELECT 'dictaminar' AS tipo, c.id, c.name, COALESCE(c.en_revision_desde, c.updated_at) AS desde FROM campanas c
        WHERE c.status = 'en_revision' AND c.creator_id <> $1
          AND ((c.supervisor_id IS NULL AND NOT c.supervisado_por_root) OR c.supervisor_id = $1)
       UNION ALL
       SELECT 'datos', c.id, c.name, c.updated_at FROM campanas c
         JOIN campana_datos_abiertos d ON d.campana_id = c.id AND d.estado = 'pendiente'
        WHERE c.supervisor_id = $1 AND c.status = 'finalizada' AND ${sqlSinTicketDeDatos("c")}
       UNION ALL
       SELECT 'reanudar', c.id, c.name, c.ajustes_en FROM campanas c
        WHERE c.supervisor_id = $1 AND c.status = 'pausada' AND c.pausa_por = 'supervision' AND c.ajustes_en IS NOT NULL`,
      [usuarioId],
    ),
    contarReportesPendientes(usuarioId, usuarioId),
  ]);
  const lista: Pendiente[] = rows.map((r) => {
    const dias = diasDesde(r.desde);
    if (r.tipo === "dictaminar") {
      return {
        clave: `dictaminar-${r.id}`,
        seccion: "supervision",
        texto: `Dictaminar ${nombre(r.name)}`,
        href: `/supervision/${r.id}`,
        urgencia: alMenosPronto(urgenciaPorEspera(dias)),
        detalle: `En revisión desde ${haceCuanto(dias)}: no recibe aportes hasta que se acepte`,
        desde: iso(r.desde),
      };
    }
    if (r.tipo === "datos") {
      return {
        clave: `datos-${r.id}`,
        seccion: "supervision",
        texto: `Decidir los datos abiertos de ${nombre(r.name)}`,
        href: `/supervision/${r.id}`,
        urgencia: urgenciaPorEspera(dias),
        detalle: `Finalizada ${haceCuanto(dias)}`,
        desde: iso(r.desde),
      };
    }
    return {
      clave: `reanudar-${r.id}`,
      seccion: "supervision",
      texto: `Reanudar ${nombre(r.name)}, ya ajustada`,
      href: `/supervision/${r.id}`,
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `El creador la ajustó ${haceCuanto(dias)}`,
      desde: iso(r.desde),
    };
  });
  if (reportes.casos > 0) {
    const dias = diasDesde(reportes.masViejo);
    lista.push({
      clave: "reportes",
      seccion: "supervision",
      texto: `Resolver ${plural(reportes.casos, "reporte", "reportes")}`,
      href: "/supervision/reportes",
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `El más antiguo llegó ${haceCuanto(dias)}`,
      desde: iso(reportes.masViejo),
    });
  }
  return lista;
}

async function deRevisor(usuarioId: number, terminados: string[]): Promise<Pendiente[]> {
  const [invitaciones, aportes] = await Promise.all([
    pool.query<{ id: number; name: string; desde: Date | null }>(
      `SELECT c.id, c.name, cr.invitado_en AS desde
         FROM campana_revisores cr JOIN campanas c ON c.id = cr.campana_id
        WHERE cr.usuario_id = $1 AND cr.estado = 'invitado' AND NOT (c.status = ANY($2::text[]))`,
      [usuarioId, terminados],
    ),
    // Como GET /api/revisiones y el dashboard del revisor: sin los aportes propios, en campañas que no terminaron.
    pool.query<{ id: number; name: string; pendientes: number; desde: Date | null }>(
      `SELECT c.id, c.name, COUNT(a.id)::int AS pendientes, MIN(a.submitted_at) AS desde
         FROM campana_revisores cr
         JOIN campanas c ON c.id = cr.campana_id
         JOIN aportes a ON a.campaign_id = c.id AND a.status = 'pendiente' AND a.user_id IS DISTINCT FROM cr.usuario_id
        WHERE cr.usuario_id = $1 AND cr.estado = 'aceptado' AND NOT (c.status = ANY($2::text[]))
        GROUP BY c.id, c.name`,
      [usuarioId, terminados],
    ),
  ]);
  return [
    ...invitaciones.rows.map((r): Pendiente => {
      const dias = diasDesde(r.desde);
      return {
        clave: `invitacion-${r.id}`,
        seccion: "revision",
        texto: `Responder la invitación para revisar ${nombre(r.name)}`,
        href: "/notificaciones",
        urgencia: alMenosPronto(urgenciaPorEspera(dias)),
        detalle: `Te invitaron ${haceCuanto(dias)}`,
        desde: iso(r.desde),
      };
    }),
    ...aportes.rows.map((r): Pendiente => {
      const dias = diasDesde(r.desde);
      return {
        clave: `revisar-${r.id}`,
        seccion: "revision",
        texto: `Revisar ${plural(r.pendientes, "aporte", "aportes")} de ${nombre(r.name)}`,
        href: `/revisiones/campanas/${r.id}`,
        urgencia: alMenosPronto(urgenciaPorEspera(dias)),
        detalle: `El más antiguo espera desde ${haceCuanto(dias)}`,
        desde: iso(r.desde),
      };
    }),
  ];
}

async function deCreador(usuarioId: number, terminados: string[], puedeEnviar: boolean, hoy: string): Promise<Pendiente[]> {
  const [aportes, propias, porCerrar] = await Promise.all([
    pool.query<{ id: number; name: string; pendientes: number; desde: Date | null }>(
      `SELECT c.id, c.name, COUNT(a.id)::int AS pendientes, MIN(a.submitted_at) AS desde
         FROM campanas c
         JOIN aportes a ON a.campaign_id = c.id AND a.status = 'pendiente'
        WHERE c.creator_id = $1 AND NOT (c.status = ANY($2::text[]))
        GROUP BY c.id, c.name`,
      [usuarioId, terminados],
    ),
    pool.query<{ tipo: "rechazada" | "ajustar" | "borrador"; id: number; name: string; desde: Date | null }>(
      `SELECT CASE WHEN status = 'rechazada' THEN 'rechazada' WHEN status = 'borrador' THEN 'borrador' ELSE 'ajustar' END AS tipo,
              id, name, CASE WHEN status = 'pausada' THEN COALESCE(pausada_en, updated_at) ELSE updated_at END AS desde
         FROM campanas
        WHERE creator_id = $1
          AND (status IN ('rechazada', 'borrador') OR (status = 'pausada' AND pausa_por = 'supervision' AND ajustes_en IS NULL))`,
      [usuarioId],
    ),
    // Nuevo (2026-11-24): activas que cierran en DIAS_DE_CIERRE_PRONTO días sin llegar a la meta (de aprobados).
    pool.query<{ id: number; name: string; dias: number; cierre: string; aprobados: number; meta: number }>(
      `SELECT c.id, c.name, (c.end_date - $2::date)::int AS dias, to_char(c.end_date, 'YYYY-MM-DD') AS cierre,
              COALESCE(e.approved_contributions, 0)::int AS aprobados, c.goal_contributions::int AS meta
         FROM campanas c LEFT JOIN campana_estadisticas e ON e.campana_id = c.id
        WHERE c.creator_id = $1 AND c.status = 'activa'
          AND c.end_date BETWEEN $2::date AND $3::date
          AND COALESCE(e.approved_contributions, 0) < c.goal_contributions`,
      [usuarioId, hoy, sumarDias(hoy, DIAS_DE_CIERRE_PRONTO)],
    ),
  ]);
  const lista: Pendiente[] = aportes.rows.map((r) => {
    const dias = diasDesde(r.desde);
    return {
      clave: `mis-aportes-${r.id}`,
      seccion: "campanas",
      texto: `Revisar ${plural(r.pendientes, "aporte", "aportes")} de ${nombre(r.name)}`,
      href: `/mis-campanas/${r.id}/aportes`,
      urgencia: alMenosPronto(urgenciaPorEspera(dias)),
      detalle: `El más antiguo espera desde ${haceCuanto(dias)}`,
      desde: iso(r.desde),
    };
  });
  for (const r of propias.rows) {
    const dias = diasDesde(r.desde);
    if (r.tipo === "ajustar") {
      lista.push({
        clave: `ajustar-${r.id}`,
        seccion: "campanas",
        texto: `Ajustar ${nombre(r.name)}, pausada por la supervisión`,
        href: `/mis-campanas/${r.id}`,
        urgencia: alMenosPronto(urgenciaPorEspera(dias)),
        detalle: `Pausada ${haceCuanto(dias)}: no recibe aportes`,
        desde: iso(r.desde),
      });
    } else if (puedeEnviar && r.tipo === "rechazada") {
      lista.push({
        clave: `corregir-${r.id}`,
        seccion: "campanas",
        texto: `Corregir y reenviar ${nombre(r.name)}`,
        href: `/mis-campanas/nueva?edit=${r.id}`,
        urgencia: "normal",
        detalle: `Rechazada ${haceCuanto(dias)}`,
        desde: iso(r.desde),
      });
    } else if (puedeEnviar && r.tipo === "borrador") {
      lista.push({
        clave: `borrador-${r.id}`,
        seccion: "campanas",
        texto: `Terminar el borrador ${nombre(r.name)}`,
        href: `/mis-campanas/nueva?edit=${r.id}`,
        urgencia: "normal",
        detalle: `Lo editaste por última vez ${haceCuanto(dias)}`,
        desde: iso(r.desde),
      });
    }
  }
  for (const r of porCerrar.rows) {
    lista.push({
      clave: `compartir-${r.id}`,
      seccion: "campanas",
      texto: `Compartir ${nombre(r.name)}: va en ${porcentajeDeMeta(r.aprobados, r.meta)} % de su meta`,
      href: `/campanas/${r.id}`,
      urgencia: urgenciaPorCierre(r.dias),
      detalle: cuandoCierra(r.dias),
      desde: isoDeDia(r.cierre),
    });
  }
  return lista;
}

async function paraAportar(usuarioId: number, hoy: string): Promise<Pendiente[]> {
  const cuotas = await campanasConCuotaPendiente(usuarioId, {
    favoritasQueCierranAntesDe: sumarDias(hoy, DIAS_DE_CIERRE_PRONTO),
    limite: CUOTAS_EN_PENDIENTES,
  });
  return cuotas.map((c) => {
    const cierre = c.end_date ? new Date(c.end_date).toISOString().slice(0, 10) : null;
    const dias = cierre ? Math.round((Date.parse(cierre) - Date.parse(hoy)) / 86_400_000) : null;
    return {
      clave: `aportar-${c.id}`,
      seccion: "aportar",
      texto: `Aportar a ${nombre(c.name)}: ${c.faltan === 1 ? "te falta 1 aporte" : `te faltan ${c.faltan} aportes`}`,
      href: `/campanas/${c.id}`,
      urgencia: dias === null ? "normal" : urgenciaPorCierre(dias),
      detalle: dias === null ? undefined : cuandoCierra(dias),
      desde: isoDeDia(cierre),
    };
  });
}

async function deApelaciones(usuarioId: number): Promise<Pendiente[]> {
  const { rows } = await pool.query<{ id: number; estado: string; resuelta_en: Date }>(
    `SELECT id, estado, resuelta_en FROM apelaciones
      WHERE usuario_id = $1 AND estado <> 'pendiente' AND resuelta_en > NOW() - make_interval(days => $2)`,
    [usuarioId, DIAS_DE_APELACION_RESPONDIDA],
  );
  return rows.map((r) => ({
    clave: `apelacion-${r.id}`,
    seccion: "apelaciones",
    texto: r.estado === "aceptada" ? "Leer la respuesta: tu apelación fue aceptada" : "Leer la respuesta a tu apelación",
    href: "/mis-apelaciones",
    urgencia: "normal",
    detalle: `Respondida ${haceCuanto(diasDesde(r.resuelta_en))}`,
    desde: iso(r.resuelta_en),
  }));
}

async function dePerfil(usuario: SessionUser): Promise<Pendiente[]> {
  const lista: Pendiente[] = [];
  if ((usuario.intereses ?? []).length === 0) {
    lista.push({
      clave: "tematicas",
      seccion: "perfil",
      texto: "Elegir tus temáticas de interés",
      href: "/cuenta?resaltarTematicas=1#mis-intereses",
      urgencia: "normal",
      detalle: "Para recomendarte campañas que te interesan",
    });
  }
  if (!usuario.state && !(await zonaDetectadaDe(usuario.id))) {
    lista.push({
      clave: "ubicacion",
      seccion: "perfil",
      texto: "Agregar tu ubicación",
      href: "/cuenta",
      urgencia: "normal",
      detalle: "Para mostrarte las campañas de tu zona",
    });
  }
  return lista;
}

async function sugerenciaDeCampana(usuario: SessionUser, hoy: string, sin: string[]): Promise<Pendiente | null> {
  const { rows } = await pool.query<{ id: number; name: string; dias: number }>(
    `SELECT c.id, c.name, (c.end_date - $2::date)::int AS dias
       FROM campanas c
       JOIN campana_estadisticas e ON e.campana_id = c.id
      WHERE c.status = 'activa' AND c.creator_id <> $1
        AND c.end_date BETWEEN $2::date AND $3::date
        AND e.approved_contributions < c.goal_contributions
        AND NOT (c.id::text = ANY($5::text[]))
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
      ORDER BY (c.tematica = ANY($4::text[])) DESC, c.end_date ASC, c.id
      LIMIT 1`,
    [usuario.id, hoy, sumarDias(hoy, DIAS_DE_CIERRE_PRONTO), usuario.intereses ?? [], sin],
  );
  const fila = rows[0];
  return fila
    ? {
        clave: `sugerencia-${fila.id}`,
        seccion: "sugerencia",
        texto: `${nombre(fila.name)} necesita aportes`,
        href: `/campanas/${fila.id}`,
        urgencia: "normal",
        detalle: cuandoCierra(fila.dias),
      }
    : null;
}

/** Los pendientes de esta persona. Puede lanzar: quien la llama decide qué mostrar si falla. */
export async function pendientesDelUsuario(usuario: SessionUser): Promise<PendientesDelUsuario> {
  const hoy = hoyEnTepic();
  const terminados = [...ESTADOS_TERMINADOS];
  const roles = usuario.role ?? [];
  const id = Number(usuario.id);
  const aporta = puedeAportar(roles);
  const grupos = await Promise.all([
    roles.includes("supervisor") ? deSupervisor(id) : Promise.resolve([]),
    deRevisor(id, terminados),
    deCreador(id, terminados, puedeCrearCampanas(roles), hoy),
    aporta ? paraAportar(id, hoy) : Promise.resolve([]),
    deApelaciones(id),
    dePerfil(usuario),
  ]);
  const pendientes = ordenarPendientes(grupos.flat());
  const yaListadas = pendientes.filter((p) => p.seccion === "aportar").map((p) => p.clave.replace("aportar-", ""));
  const sugerencia = aporta ? await sugerenciaDeCampana(usuario, hoy, yaListadas) : null;
  return { pendientes, sugerencia };
}
