// "Explora por temática" en mosaicos, arriba de la lista de /explorar (2026-11-11, a pedido del
// usuario; estructura tomada de la página de categorías de GoFundMe, como la ventana "Elige tus
// temáticas" de ui/SelectorDeTemas). Es el único filtro de temática de /explorar: el de la barra
// lateral se quitó el mismo día. Solo temáticas con campañas visibles (obtenerTematicasParaExplorar),
// de la que más tiene a la que menos; la elegida se marca y tocarla otra vez quita el filtro; el
// último mosaico, "Todas", lo quita. Los enlaces (`hrefDe`, `todas`) conservan los demás filtros.
// 3 por fila en móvil, 4 en tableta y 6 en escritorio. *Historia:* ese día también estuvo en la
// landing ("Campañas destacadas") y se quitó a pedido del usuario.

import Link from "next/link";
import IconoDeTematica from "@/components/ui/IconoDeTematica";

const ENLACE =
  "group flex w-full flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600";
const CUADRO =
  "relative flex aspect-square w-full items-center justify-center rounded-lg border-2 transition-colors motion-reduce:transition-none";

export default function TematicasEnMosaico({
  tematicas,
  activa,
  hrefDe,
  todas,
}: {
  tematicas: { valor: string; total: number }[];
  /** Temática elegida: se marca y su enlace quita el filtro. */
  activa?: string;
  hrefDe: (valor: string) => string;
  /** Mosaico final, que quita el filtro de temática. */
  todas: { href: string; texto: string };
}) {
  if (tematicas.length === 0) return null;

  return (
    <nav aria-labelledby="tematicas-en-mosaico">
      <h2 id="tematicas-en-mosaico" className="mb-4 text-[15px] font-bold text-system-900">
        Explora por temática
      </h2>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
        {tematicas.map((t) => {
          const elegida = t.valor === activa;
          return (
            <li key={t.valor} className="min-w-0">
              <Link href={hrefDe(t.valor)} aria-current={elegida ? "page" : undefined} className={ENLACE}>
                <span
                  className={`${CUADRO} ${
                    elegida
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-transparent bg-system-100 text-system-800 group-hover:border-brand-600 group-hover:text-brand-700"
                  }`}
                >
                  <IconoDeTematica tematica={t.valor} className="h-[38%] w-[38%]" />
                  {elegida ? (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : null}
                </span>
                <span className={`w-full break-words text-[13px] leading-4 ${elegida ? "font-semibold text-brand-800" : "font-medium text-system-900"}`}>
                  {t.valor}
                </span>
                <span className="-mt-1 font-mono text-[11px] text-system-500">
                  {t.total} {t.total === 1 ? "campaña" : "campañas"}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <Link href={todas.href} aria-current={activa ? undefined : "page"} className={ENLACE}>
            <span
              className={`${CUADRO} border-dashed ${
                activa
                  ? "border-system-300 bg-white text-system-600 group-hover:border-brand-600 group-hover:text-brand-700"
                  : "border-brand-600 bg-brand-50 text-brand-700"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[34%] w-[34%]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
                <rect x="14" y="14" width="6" height="6" rx="1" />
              </svg>
            </span>
            <span className={`w-full text-[13px] leading-4 ${activa ? "font-semibold text-system-900" : "font-semibold text-brand-800"}`}>{todas.texto}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
