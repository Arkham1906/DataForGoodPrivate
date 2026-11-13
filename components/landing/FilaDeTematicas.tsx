// Temáticas en pastillas con su ícono (2026-11-12, a pedido del usuario, como las categorías del inicio de
// GoFundMe): cada una lleva a /explorar/tematica/[slug] con todas sus campañas activas. La usa "Otras
// temáticas" de esa misma pantalla (hasta el 2026-11-13 también "Lo más reciente" de la landing). En móvil, una fila con scroll horizontal
// (`dashboard-nav`); desde tableta, las pastillas se acomodan en varias filas. `activa` marca la que se ve.

import Link from "next/link";
import IconoDeTematica from "@/components/ui/IconoDeTematica";
import { rutaDeTematica } from "@/lib/tematicas/ruta";

const nf = new Intl.NumberFormat("es-MX");

export default function FilaDeTematicas({
  tematicas,
  activa,
  etiqueta = "Temáticas",
  final,
}: {
  /** De la que más campañas tiene a la que menos (obtenerTematicasParaExplorar). */
  tematicas: { valor: string; total: number }[];
  activa?: string;
  /** Nombre de la lista para el lector de pantalla. */
  etiqueta?: string;
  /** Enlace al final de la fila, p. ej. "Ver todas" a /explorar. */
  final?: { href: string; texto: string };
}) {
  return (
    <nav aria-label={etiqueta}>
      <ul className="dashboard-nav flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0">
        {tematicas.map((t) => {
          const elegida = t.valor === activa;
          return (
            <li key={t.valor} className="shrink-0">
              <Link
                href={rutaDeTematica(t.valor)}
                aria-current={elegida ? "page" : undefined}
                className={`group flex items-center gap-2 whitespace-nowrap rounded-pill border px-3.5 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none ${
                  elegida
                    ? "border-system-900 bg-system-900 text-white"
                    : "border-system-300 bg-white text-system-700 hover:border-brand-600 hover:text-brand-700"
                }`}
              >
                <IconoDeTematica tematica={t.valor} className="h-4 w-4 shrink-0" />
                <span>{t.valor}</span>
                <span className={`font-mono text-[11.5px] ${elegida ? "text-white/75" : "text-system-500"}`}>{nf.format(t.total)}</span>
              </Link>
            </li>
          );
        })}
        {final && (
          <li className="shrink-0">
            <Link
              href={final.href}
              className="flex items-center whitespace-nowrap rounded-pill px-3.5 py-2 text-[13.5px] font-semibold text-brand-600 hover:underline"
            >
              {final.texto} →
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
