// Lo que dice el recuadro azul del menú lateral de la zona de usuario. Desde el 2026-11-13 (a pedido del usuario)
// es una lista de atajos con TODO lo que la persona tiene pendiente, un renglón con enlace por pendiente, como el del
// panel del SuperUsuario (lib/sistema/aviso-del-menu.ts). Del 2026-11-10 a ese día mostraba una sola cosa (cuota
// pendiente o una campaña que cierra pronto) y dejaba fuera lo que llega por notificación; el usuario cambió esa
// decisión: ahora entra todo. Orden (lo que bloquea a otros primero):
//   1. Supervisor (rol): campañas por dictaminar, reportes por resolver, datos abiertos por decidir y pausadas por
//      la supervisión que el creador ya ajustó (las mismas reglas que el dashboard de /supervision).
//   2. Revisor: invitaciones sin responder y aportes por revisar en las campañas donde es revisor aceptado.
//   3. Creador: aportes por revisar en sus campañas; rechazadas por corregir, pausadas por la supervisión que debe
//      ajustar (sin ajustes_en) y borradores sin enviar.
//   4. Participante: cuota pendiente (lib/campanas/cuota-pendiente.ts, la regla del recordatorio semanal).
//   5. Perfil: sin temáticas de interés; sin ubicación (ni estado en el perfil ni zona detectada).
//   6. Sugerencia (no es un pendiente): una campaña activa que cierra en 7 días y necesita aportes.
// Varios del mismo tipo van en un renglón con su número y un enlace a la lista; uno solo, con su nombre y enlace
// directo. Sin nada: la frase de siempre. La gamificación (misiones, racha) no entra (decisión del usuario).
// La llama components/layout/ShellDeUsuario en el servidor; se vuelve a calcular con cada router.refresh de
// ActualizacionEnVivo (cambio en la base) y en cada carga completa. En móvil el recuadro no se ve.

import { pool } from "@/lib/db";
import { campanasConCuotaPendiente } from "@/lib/campanas/cuota-pendiente";
import { ESTADOS_TERMINADOS } from "@/lib/campanas/terminada";
import { hoyEnTepic } from "@/lib/fecha-de-tepic";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import { zonaDetectadaDe } from "@/lib/ubicacion/zona-detectada";
import type { SessionUser } from "@/lib/session";
import type { AvisoDelMenu } from "@/components/layout/AvisoDelMenu";
import { puedeAportar, puedeCrearCampanas } from "@/lib/usuarios/rol-asignable";

/** Días hacia adelante para "cierra pronto" (campaña que necesita aportes y favoritas en la cuota pendiente). */
const DIAS_DE_CIERRE_PRONTO = 7;
/** Campañas con cuota pendiente que salen una por una. */
const CUOTAS_EN_EL_AVISO = 2;
/** Largo máximo del nombre de una campaña en un renglón (el menú es angosto). */
const LARGO_DEL_NOMBRE = 34;

export const FRASE_DEL_MENU: AvisoDelMenu = {
  texto: "Cada aporte transforma datos en impacto para tu comunidad.",
  cierre: "¡Súmate!",
};

type Renglon = { texto: string; href: string };
type CampanaCorta = { id: number; name: string };

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** «Nombre», recortado con "…" si no cabe. */
function nombre(name: string): string {
  const limpio = name.trim();
  return `«${limpio.length > LARGO_DEL_NOMBRE ? `${limpio.slice(0, LARGO_DEL_NOMBRE - 1).trimEnd()}…` : limpio}»`;
}

function sumarDias(dia: string, dias: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function cuandoCierra(dias: number): string {
  if (dias <= 0) return "cierra hoy";
  if (dias === 1) return "cierra mañana";
  return `cierra en ${dias} días`;
}

/** Uno solo: su nombre y enlace propio; varios: el número y el enlace a la lista. */
function unoOVarios(
  campanas: CampanaCorta[],
  uno: (c: CampanaCorta) => Renglon,
  varios: (n: number) => Renglon,
): Renglon[] {
  if (campanas.length === 0) return [];
  return [campanas.length === 1 ? uno(campanas[0]) : varios(campanas.length)];
}

async function pendientesDeSupervisor(usuarioId: number): Promise<Renglon[]> {
  const [{ rows }, reportes] = await Promise.all([
    pool.query<{ tipo: "dictaminar" | "datos" | "reanudar"; id: number; name: string }>(
      `SELECT 'dictaminar' AS tipo, c.id, c.name FROM campanas c
        WHERE c.status = 'en_revision' AND c.creator_id <> $1
          AND ((c.supervisor_id IS NULL AND NOT c.supervisado_por_root) OR c.supervisor_id = $1)
       UNION ALL
       SELECT 'datos', c.id, c.name FROM campanas c
         JOIN campana_datos_abiertos d ON d.campana_id = c.id AND d.estado = 'pendiente'
        WHERE c.supervisor_id = $1 AND c.status = 'finalizada'
       UNION ALL
       SELECT 'reanudar', c.id, c.name FROM campanas c
        WHERE c.supervisor_id = $1 AND c.status = 'pausada' AND c.pausa_por = 'supervision' AND c.ajustes_en IS NOT NULL`,
      [usuarioId],
    ),
    contarReportesPendientes(usuarioId, usuarioId),
  ]);
  const de = (tipo: string) => rows.filter((r) => r.tipo === tipo);
  return [
    ...unoOVarios(
      de("dictaminar"),
      (c) => ({ texto: `Dictaminar ${nombre(c.name)}`, href: `/supervision/${c.id}` }),
      (n) => ({ texto: `Dictaminar ${n} campañas`, href: "/supervision/campanas" }),
    ),
    ...(reportes.casos > 0
      ? [{ texto: `Resolver ${plural(reportes.casos, "reporte", "reportes")}`, href: "/supervision/reportes" }]
      : []),
    ...unoOVarios(
      de("datos"),
      (c) => ({ texto: `Decidir los datos abiertos de ${nombre(c.name)}`, href: `/supervision/${c.id}` }),
      (n) => ({ texto: `Decidir los datos abiertos de ${n} campañas`, href: "/supervision" }),
    ),
    ...unoOVarios(
      de("reanudar"),
      (c) => ({ texto: `Reanudar ${nombre(c.name)}, ya ajustada`, href: `/supervision/${c.id}` }),
      (n) => ({ texto: `Reanudar ${n} campañas ya ajustadas`, href: "/supervision" }),
    ),
  ];
}

async function pendientesDeRevisor(usuarioId: number, terminados: string[]): Promise<Renglon[]> {
  const [invitacionesR, aportesR] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
         FROM campana_revisores cr JOIN campanas c ON c.id = cr.campana_id
        WHERE cr.usuario_id = $1 AND cr.estado = 'invitado' AND NOT (c.status = ANY($2::text[]))`,
      [usuarioId, terminados],
    ),
    // Como GET /api/revisiones y el dashboard del revisor: sin los aportes propios, en campañas que no terminaron.
    pool.query<{ id: number; name: string; pendientes: number }>(
      `SELECT c.id, c.name, COUNT(a.id)::int AS pendientes
         FROM campana_revisores cr
         JOIN campanas c ON c.id = cr.campana_id
         JOIN aportes a ON a.campaign_id = c.id AND a.status = 'pendiente' AND a.user_id IS DISTINCT FROM cr.usuario_id
        WHERE cr.usuario_id = $1 AND cr.estado = 'aceptado' AND NOT (c.status = ANY($2::text[]))
        GROUP BY c.id, c.name`,
      [usuarioId, terminados],
    ),
  ]);
  const renglones: Renglon[] = [];
  const invitaciones = Number(invitacionesR.rows[0]?.total ?? 0);
  if (invitaciones > 0) {
    renglones.push({
      texto: `Responder ${plural(invitaciones, "invitación", "invitaciones")} de revisor`,
      href: "/notificaciones",
    });
  }
  const campanas = aportesR.rows;
  const total = campanas.reduce((suma, c) => suma + Number(c.pendientes), 0);
  if (total > 0) {
    renglones.push(
      campanas.length === 1
        ? { texto: `Revisar ${plural(total, "aporte", "aportes")} de ${nombre(campanas[0].name)}`, href: `/revisiones/campanas/${campanas[0].id}` }
        : { texto: `Revisar ${total} aportes como revisor`, href: "/revisiones/campanas" },
    );
  }
  return renglones;
}

/** `puedeEnviar`: sin el rol de creador (2026-11-22) no se le pide terminar borradores ni reenviar rechazadas. */
async function pendientesDeCreador(usuarioId: number, terminados: string[], puedeEnviar: boolean): Promise<Renglon[]> {
  const [aportesR, propiasR] = await Promise.all([
    pool.query<{ id: number; name: string; pendientes: number }>(
      `SELECT c.id, c.name, COUNT(a.id)::int AS pendientes
         FROM campanas c
         JOIN aportes a ON a.campaign_id = c.id AND a.status = 'pendiente'
        WHERE c.creator_id = $1 AND NOT (c.status = ANY($2::text[]))
        GROUP BY c.id, c.name`,
      [usuarioId, terminados],
    ),
    pool.query<{ tipo: "rechazada" | "ajustar" | "borrador"; id: number; name: string }>(
      `SELECT CASE WHEN status = 'rechazada' THEN 'rechazada' WHEN status = 'borrador' THEN 'borrador' ELSE 'ajustar' END AS tipo,
              id, name
         FROM campanas
        WHERE creator_id = $1
          AND (status IN ('rechazada', 'borrador') OR (status = 'pausada' AND pausa_por = 'supervision' AND ajustes_en IS NULL))
        ORDER BY updated_at DESC`,
      [usuarioId],
    ),
  ]);
  const renglones: Renglon[] = [];
  const conAportes = aportesR.rows;
  const total = conAportes.reduce((suma, c) => suma + Number(c.pendientes), 0);
  if (total > 0) {
    renglones.push(
      conAportes.length === 1
        ? { texto: `Revisar ${plural(total, "aporte", "aportes")} de ${nombre(conAportes[0].name)}`, href: `/mis-campanas/${conAportes[0].id}/aportes` }
        : { texto: `Revisar ${total} aportes de tus campañas`, href: "/mis-campanas" },
    );
  }
  const de = (tipo: string) =>
    propiasR.rows.filter((r) => r.tipo === tipo && (puedeEnviar || (tipo !== "rechazada" && tipo !== "borrador")));
  renglones.push(
    ...unoOVarios(
      de("rechazada"),
      (c) => ({ texto: `Corregir y reenviar ${nombre(c.name)}`, href: `/mis-campanas/nueva?edit=${c.id}` }),
      (n) => ({ texto: `Corregir ${n} campañas rechazadas`, href: "/mis-campanas" }),
    ),
    ...unoOVarios(
      de("ajustar"),
      (c) => ({ texto: `Ajustar ${nombre(c.name)}, pausada por la supervisión`, href: `/mis-campanas/${c.id}` }),
      (n) => ({ texto: `Ajustar ${n} campañas pausadas por la supervisión`, href: "/mis-campanas" }),
    ),
    ...unoOVarios(
      de("borrador"),
      (c) => ({ texto: `Terminar el borrador ${nombre(c.name)}`, href: `/mis-campanas/nueva?edit=${c.id}` }),
      (n) => ({ texto: `Terminar ${n} borradores`, href: "/mis-campanas" }),
    ),
  );
  return renglones;
}

async function pendientesDePerfil(usuario: SessionUser): Promise<Renglon[]> {
  const renglones: Renglon[] = [];
  if ((usuario.intereses ?? []).length === 0) {
    renglones.push({ texto: "Elegir tus temáticas de interés", href: "/cuenta?resaltarTematicas=1#mis-intereses" });
  }
  if (!usuario.state && !(await zonaDetectadaDe(usuario.id))) {
    renglones.push({ texto: "Agregar tu ubicación", href: "/cuenta" });
  }
  return renglones;
}

async function campanaQueNecesitaAportes(usuario: SessionUser, hoy: string, sin: number[]): Promise<Renglon | null> {
  const { rows } = await pool.query<{ id: number; name: string; dias: number }>(
    `SELECT c.id, c.name, (c.end_date - $2::date)::int AS dias
       FROM campanas c
       JOIN campana_estadisticas e ON e.campana_id = c.id
      WHERE c.status = 'activa' AND c.creator_id <> $1
        AND c.end_date BETWEEN $2::date AND $3::date
        AND e.approved_contributions < c.goal_contributions
        AND NOT (c.id = ANY($5::int[]))
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
      ORDER BY (c.tematica = ANY($4::text[])) DESC, c.end_date ASC, c.id
      LIMIT 1`,
    [usuario.id, hoy, sumarDias(hoy, DIAS_DE_CIERRE_PRONTO), usuario.intereses ?? [], sin],
  );
  const fila = rows[0];
  return fila
    ? { texto: `${nombre(fila.name)} ${cuandoCierra(fila.dias)} y necesita aportes`, href: `/campanas/${fila.id}` }
    : null;
}

/** El aviso del menú lateral para esta persona. Nunca lanza: si algo falla, la frase de siempre. */
export async function avisoDelMenuParaUsuario(usuario: SessionUser): Promise<AvisoDelMenu> {
  try {
    const hoy = hoyEnTepic();
    const terminados = [...ESTADOS_TERMINADOS];
    const roles = usuario.role ?? [];
    // Sin el rol de aportador (2026-11-22) no se le invita a aportar: ni cuotas ni sugerencia.
    const aporta = puedeAportar(roles);
    const [supervisor, revisor, creador, cuotas, perfil] = await Promise.all([
      roles.includes("supervisor") ? pendientesDeSupervisor(usuario.id) : Promise.resolve([]),
      pendientesDeRevisor(usuario.id, terminados),
      pendientesDeCreador(usuario.id, terminados, puedeCrearCampanas(roles)),
      aporta
        ? campanasConCuotaPendiente(usuario.id, {
            favoritasQueCierranAntesDe: sumarDias(hoy, DIAS_DE_CIERRE_PRONTO),
            limite: CUOTAS_EN_EL_AVISO,
          })
        : Promise.resolve([]),
      pendientesDePerfil(usuario),
    ]);
    const aportar: Renglon[] = cuotas.map((c) => ({
      texto: `Aportar a ${nombre(c.name)}: ${c.faltan === 1 ? "te falta 1" : `te faltan ${c.faltan}`}`,
      href: `/campanas/${c.id}`,
    }));
    const pendientes = [...supervisor, ...revisor, ...creador, ...aportar, ...perfil];
    const sugerencia = aporta ? await campanaQueNecesitaAportes(usuario, hoy, cuotas.map((c) => Number(c.id))) : null;

    if (pendientes.length > 0) {
      return {
        texto: pendientes.length === 1 ? "Tienes 1 pendiente:" : `Tienes ${pendientes.length} pendientes:`,
        renglones: sugerencia ? [...pendientes, sugerencia] : pendientes,
      };
    }
    if (sugerencia) {
      return { texto: "Te puede interesar:", renglones: [sugerencia] };
    }
    return FRASE_DEL_MENU;
  } catch (error) {
    console.error("No se pudo armar el aviso del menú lateral", error);
    return FRASE_DEL_MENU;
  }
}
