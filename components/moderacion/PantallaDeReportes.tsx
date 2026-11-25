// Contenido de la bandeja de reportes (2026-10-12) de la moderación: /supervisar/reportes (SuperUsuario en
// modo supervisor) y /supervision/reportes (usuario con rol de supervisor), desde el 2026-10-13; antes era
// /reportes del panel. Reportes de campañas (contra su creador) y de aportes (contra quien los envió).
// Server Component; la página de cada zona comprueba antes la sesión (exigirModerador).
// Datos: listarReportes() y contarReportesPendientes() (lib/reportes/reportes.ts), sin los reportes contra el
// supervisor que modera; los reportes de aportes solo se muestran a quien supervisa esa campaña.
// ?estado=resueltos muestra los ya resueltos. La lista agrupada por caso está en
// ListaDeReportes (cliente). Acciones: "Elegir sanción para <persona>" lleva a .../sanciones/[usuarioId]?reportes=<clave>
// (aviso, suspensión o baneo, y resuelve los reportes); "Descartar" en BotonDescartar.

import Link from "next/link";

import { Aviso, Encabezado, formatearNumero } from "@/components/sistema/ui";
import { contarReportesPendientes, listarReportes, type FiltroDeReportes } from "@/lib/reportes/reportes";
import { cuentaDelModerador, type Moderador } from "@/lib/moderacion/moderador";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import { formatearFechaYHora } from "@/lib/usuarios/directorio";
import ListaDeReportes, { type GrupoParaLista } from "./ListaDeReportes";
import PestanasDeModeracion from "./PestanasDeModeracion";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";

const NOMBRE_DE_SANCION: Record<string, string> = {
  STRIKE: "Aviso",
  SUSPENSION_TEMPORAL: "Suspensión",
  BANEO_DE_CAMPANA: "Baneo",
};

export default async function PantallaDeReportes({
  zona,
  moderador,
  estado,
  filtros = {},
}: {
  zona: ZonaDeModeracion;
  moderador: Moderador;
  /** ?estado= de la URL: "resueltos" o nada (pendientes). */
  estado?: string;
  /** Filtros de la lista (2026-11-22): ?q= (campaña, persona reportada, motivo o quién reportó) y ?tipo=. */
  filtros?: { q?: string; tipo?: string };
}) {
  const rutas = rutasDeModeracion(zona);
  const filtro: FiltroDeReportes = estado === "resueltos" ? "resueltos" : "pendientes";
  const propia = cuentaDelModerador(moderador);
  const supervisorId = zona === "supervision" && moderador.tipo === "usuario" ? moderador.usuarioId : null;

  const [grupos, pendientes] = await Promise.all([
    listarReportes(filtro, propia, supervisorId),
    contarReportesPendientes(propia, supervisorId),
  ]);

  const q = busquedaDeLaUrl(filtros.q);
  const tipo = opcionDeLaUrl(filtros.tipo, ["campana", "aporte"] as const);
  const filtrados = grupos.filter(
    (g) =>
      (!tipo || g.tipo === tipo) &&
      coincideConLaBusqueda(
        q,
        g.campana.nombre,
        g.reportado?.nombre,
        g.aporteId,
        ...g.reportes.flatMap((r) => [r.motivo, r.descripcion, r.quien]),
      ),
  );

  // Pendientes y Resueltos conservan la búsqueda y el tipo.
  const conservar = new URLSearchParams();
  if (typeof filtros.q === "string" && filtros.q.trim()) conservar.set("q", filtros.q.trim().slice(0, 100));
  if (tipo) conservar.set("tipo", tipo);
  const extra = conservar.toString();
  const hrefPendientes = extra ? `${rutas.reportes}?${extra}` : rutas.reportes;
  const hrefResueltos = extra ? `${rutas.reportesResueltos}&${extra}` : rutas.reportesResueltos;

  const paraLista: GrupoParaLista[] = filtrados.map((g) => ({
    clave: g.clave,
    tipo: g.tipo,
    campana: g.campana,
    aporteId: g.aporteId,
    reportado: g.reportado,
    enTicket: g.enTicket ?? false,
    reportes: g.reportes.map((r) => ({
      id: r.id,
      quien: r.quien,
      motivo: r.motivo,
      descripcion: r.descripcion,
      fechaTexto: formatearFechaYHora(r.fecha),
      estado: r.estado,
      resueltoTexto: r.resueltoEn ? formatearFechaYHora(r.resueltoEn) : null,
      nota: r.nota,
      sancion: r.sancion ? (NOMBRE_DE_SANCION[r.sancion.tipo] ?? r.sancion.tipo) : null,
    })),
  }));

  const claseChip = (activo: boolean) =>
    `inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
      activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
    }`;

  return (
    <div>
      <PestanasDeModeracion zona={zona} />

      <Encabezado
        titulo="Reportes"
        descripcion="Lo que reportaron las personas sobre campañas y aportes, agrupado por caso. Elige una sanción para la persona reportada o descarta el reporte."
        subtitulo={
          pendientes.reportes === 0
            ? "Sin reportes pendientes"
            : `${formatearNumero(pendientes.reportes)} ${pendientes.reportes === 1 ? "reporte pendiente" : "reportes pendientes"} en ${formatearNumero(pendientes.casos)} ${pendientes.casos === 1 ? "caso" : "casos"}`
        }
      />

      <nav
        className="dashboard-nav mb-4 w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
        aria-label="Filtrar reportes"
      >
        <Link href={hrefPendientes} scroll={false} className={claseChip(filtro === "pendientes")} aria-current={filtro === "pendientes" ? "true" : undefined}>
          Pendientes&nbsp; <span className="font-mono text-[11px]">{formatearNumero(pendientes.reportes)}</span>
        </Link>
        <Link href={hrefResueltos} scroll={false} className={claseChip(filtro === "resueltos")} aria-current={filtro === "resueltos" ? "true" : undefined}>
          Resueltos
        </Link>
      </nav>

      {grupos.length > 0 && (
        <FiltrosEnLaUrl
          busqueda={{ etiqueta: "Buscar reportes", placeholder: "Buscar por campaña, persona o motivo" }}
          listas={[
            {
              clave: "tipo",
              etiqueta: "Filtrar por qué se reportó",
              todas: "Campañas y aportes",
              opciones: [
                { valor: "campana", etiqueta: "Solo campañas" },
                { valor: "aporte", etiqueta: "Solo aportes" },
              ],
            },
          ]}
          className="mb-4"
        />
      )}

      {grupos.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">
          {filtro === "pendientes" ? "No hay reportes por revisar." : "Todavía no se ha resuelto ningún reporte."}
        </p>
      ) : paraLista.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ningún reporte coincide con los filtros.</p>
      ) : (
        <>
          {paraLista.length < grupos.length && (
            <p className="mb-3 text-[12.5px] text-system-500">{cuantosDeCuantos(paraLista.length, grupos.length)} casos</p>
          )}
          <ListaDeReportes zona={zona} grupos={paraLista} />
        </>
      )}

      <Aviso tono="neutro" className="mt-5">
        Una campaña la reporta cualquier persona con cuenta que no la creó (va contra su creador); un aporte, quien
        creó la campaña o un revisor (va contra quien lo envió). La persona reportada no se entera ni sabe quién
        la reportó: si das el aviso, recibe solo el aviso, que queda en el registro de sanciones. Escala de
        avisos: 1.º mensaje, 2.º suspensión de 2 días, 3.º de 7 días, 4.º baneo y correo a la lista negra.
        Resueltos muestra los últimos 300.{propia ? " Los reportes contra ti no aparecen aquí: los resuelve otro supervisor." : ""}
      </Aviso>
    </div>
  );
}
