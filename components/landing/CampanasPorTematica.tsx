// Secciones por temática de /explorar (2026-11-13, a pedido del usuario: con la estructura de la página "discover"
// de GoFundMe, no con su marca ni sus textos). Una sección por temática con su ícono, su nombre y hasta 3 campañas
// (las que más aportes aprobados tienen o las más nuevas; lo elige /explorar) en la tarjeta pública de siempre.
// "Ver todas" abre la pantalla de la temática (/explorar/tematica/[slug]) con todas sus campañas.
// En móvil, las 3 tarjetas van en una fila con scroll horizontal (`dashboard-nav`, se ve que hay más); desde
// tableta, en rejilla (2 y luego 3 por fila). Server Component.

import Link from "next/link";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import IconoDeTematica from "@/components/ui/IconoDeTematica";
import type { CampanaPublica } from "@/lib/campanas/publicas";
import { rutaDeTematica, slugDeTematica } from "@/lib/tematicas/ruta";

const nf = new Intl.NumberFormat("es-MX");

export type SeccionDeTematica = {
  tematica: string;
  /** Campañas activas de la temática (todas, no solo las que se muestran). */
  total: number;
  campanas: CampanaPublica[];
};

export default function CampanasPorTematica({ secciones }: { secciones: SeccionDeTematica[] }) {
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {secciones.map((s) => {
        const id = `tematica-${slugDeTematica(s.tematica)}`;
        return (
          <section key={s.tematica} aria-labelledby={id}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id={id} className="flex min-w-0 items-center gap-3 text-[20px] font-semibold tracking-tight text-system-900 md:text-[24px]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-system-100 text-system-800" aria-hidden="true">
                  <IconoDeTematica tematica={s.tematica} className="h-5 w-5" />
                </span>
                <span className="min-w-0 break-words">{s.tematica}</span>
              </h2>
              <Link
                href={rutaDeTematica(s.tematica)}
                className="shrink-0 whitespace-nowrap rounded-pill border border-system-300 px-3.5 py-1.5 text-[13px] font-semibold text-system-800 transition-colors hover:border-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
              >
                Ver todas<span className="sr-only"> las campañas de {s.tematica}</span>
                <span className="ml-1.5 font-mono text-[11.5px] font-normal text-system-500">{nf.format(s.total)}</span>
              </Link>
            </div>
            <ul className="dashboard-nav flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
              {s.campanas.map((c, i) => (
                // flex: la tarjeta toma el alto de la fila, como en /explorar (sin portada no queda más corta).
                <li key={c.id} className="flex w-[85%] min-w-0 shrink-0 snap-start *:w-full sm:w-auto">
                  <TarjetaDeCampanaPublica campana={c} indice={i} nivel="h3" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
