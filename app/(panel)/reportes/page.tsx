// Pantalla /reportes (2026-10-12): bandeja de reportes del SuperUsuario (de campañas, contra su creador,
// y de aportes, contra quien los envió).
// Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()). Server Component.
// Datos: listarReportes() y contarReportesPendientes() (lib/reportes/reportes.ts); ?estado=resueltos
// muestra los ya resueltos. La lista agrupada por caso está en lista.tsx (cliente).
// Acciones: "Dar aviso a <persona>" lleva a /usuarios/[id]/sancion?reportes=<clave> (el aviso queda en
// /usuarios/sanciones y resuelve los reportes); "Descartar" en boton-descartar.tsx.

import type { Metadata } from "next";
import Link from "next/link";

import { Aviso, Encabezado, formatearNumero } from "@/components/sistema/ui";
import { contarReportesPendientes, listarReportes, type FiltroDeReportes } from "@/lib/reportes/reportes";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { formatearFechaYHora } from "@/lib/usuarios/directorio";
import ListaDeReportes, { type GrupoParaLista } from "./lista";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

const NOMBRE_DE_SANCION: Record<string, string> = {
  STRIKE: "Aviso",
  BANEO_DE_CAMPANA: "Baneo",
};

export default async function BandejaDeReportesPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await exigirSesionRoot();
  const { estado } = await searchParams;
  const filtro: FiltroDeReportes = estado === "resueltos" ? "resueltos" : "pendientes";

  const [grupos, pendientes] = await Promise.all([listarReportes(filtro), contarReportesPendientes()]);

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
        <Link href="/reportes" scroll={false} className={claseChip(filtro === "pendientes")} aria-current={filtro === "pendientes" ? "true" : undefined}>
          Pendientes&nbsp; <span className="font-mono text-[11px]">{formatearNumero(pendientes.reportes)}</span>
        </Link>
        <Link href="/reportes?estado=resueltos" scroll={false} className={claseChip(filtro === "resueltos")} aria-current={filtro === "resueltos" ? "true" : undefined}>
          Resueltos
        </Link>
      </nav>

      {paraLista.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">
          {filtro === "pendientes" ? "No hay reportes por revisar." : "Todavía no se ha resuelto ningún reporte."}
        </p>
      ) : (
        <ListaDeReportes grupos={paraLista} />
      )}

      <Aviso tono="neutro" className="mt-5">
        Una campaña la reporta cualquier persona con cuenta que no la creó (va contra su creador); un aporte, quien
        creó la campaña o un revisor (va contra quien lo envió). La persona reportada no se entera ni sabe quién
        la reportó: si das el aviso, recibe solo el aviso, que queda en el registro de sanciones. Escala de
        avisos: 1.º mensaje, 2.º suspensión de 2 días, 3.º de 7 días, 4.º baneo y correo a la lista negra.
        Resueltos muestra los últimos 300.
      </Aviso>
    </div>
  );
}
