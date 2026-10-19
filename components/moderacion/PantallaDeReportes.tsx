// Contenido de la bandeja de reportes (2026-10-12) de la moderación: /supervisar/reportes (SuperUsuario en
// modo supervisor) y /supervision/reportes (usuario con rol de supervisor), desde el 2026-10-13; antes era
// /reportes del panel. Reportes de campañas (contra su creador) y de aportes (contra quien los envió).
// Server Component; la página de cada zona comprueba antes la sesión (exigirModerador).
// Datos: listarReportes() y contarReportesPendientes() (lib/reportes/reportes.ts), sin los reportes contra el
// supervisor que modera; ?estado=resueltos muestra los ya resueltos. La lista agrupada por caso está en
// ListaDeReportes (cliente). Acciones: "Dar aviso a <persona>" lleva a .../sanciones/[usuarioId]?reportes=<clave>
// (el aviso queda en la lista de sanciones y resuelve los reportes); "Descartar" en BotonDescartar.

import Link from "next/link";

import { Aviso, Encabezado, formatearNumero } from "@/components/sistema/ui";
import { contarReportesPendientes, listarReportes, type FiltroDeReportes } from "@/lib/reportes/reportes";
import { cuentaDelModerador, type Moderador } from "@/lib/moderacion/moderador";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import { formatearFechaYHora } from "@/lib/usuarios/directorio";
import ListaDeReportes, { type GrupoParaLista } from "./ListaDeReportes";
import PestanasDeModeracion from "./PestanasDeModeracion";

const NOMBRE_DE_SANCION: Record<string, string> = {
  STRIKE: "Aviso",
  SUSPENSION_TEMPORAL: "Suspensión",
  BANEO_DE_CAMPANA: "Baneo",
};

export default async function PantallaDeReportes({
  zona,
  moderador,
  estado,
}: {
  zona: ZonaDeModeracion;
  moderador: Moderador;
  /** ?estado= de la URL: "resueltos" o nada (pendientes). */
  estado?: string;
}) {
  const rutas = rutasDeModeracion(zona);
  const filtro: FiltroDeReportes = estado === "resueltos" ? "resueltos" : "pendientes";
  const propia = cuentaDelModerador(moderador);

  const [grupos, pendientes] = await Promise.all([listarReportes(filtro, propia), contarReportesPendientes(propia)]);

  const paraLista: GrupoParaLista[] = grupos.map((g) => ({
    clave: g.clave,
    tipo: g.tipo,
    campana: g.campana,
    aporteId: g.aporteId,
    reportado: g.reportado,
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
        <Link href={rutas.reportes} scroll={false} className={claseChip(filtro === "pendientes")} aria-current={filtro === "pendientes" ? "true" : undefined}>
          Pendientes&nbsp; <span className="font-mono text-[11px]">{formatearNumero(pendientes.reportes)}</span>
        </Link>
        <Link href={rutas.reportesResueltos} scroll={false} className={claseChip(filtro === "resueltos")} aria-current={filtro === "resueltos" ? "true" : undefined}>
          Resueltos
        </Link>
      </nav>

      {paraLista.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">
          {filtro === "pendientes" ? "No hay reportes por revisar." : "Todavía no se ha resuelto ningún reporte."}
        </p>
      ) : (
        <ListaDeReportes zona={zona} grupos={paraLista} />
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
