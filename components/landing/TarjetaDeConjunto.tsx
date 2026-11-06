// Tarjeta horizontal de un conjunto de datos abiertos (2026-11-06), con portada de color y la temática encima.
// La usan la landing y /datos; `detalle` agrega lo que solo importa al comparar en el catálogo: verificado,
// fecha de cierre y lugar. Server Component: recibe el conjunto ya armado por lib/open-data.ts.

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { DATA_TYPE_LABELS, type OpenDataset } from "@/lib/open-data";

const PORTADAS = ["from-brand-600 to-brand-900", "from-success-700 to-success-900"];

const nf = new Intl.NumberFormat("es-MX");

export default function TarjetaDeConjunto({
  conjunto: c,
  indice,
  detalle = false,
}: {
  conjunto: OpenDataset;
  /** Posición en la lista: alterna el color de la portada. */
  indice: number;
  detalle?: boolean;
}) {
  // Los tipos de dato que recabó la campaña (2026-11-06, a pedido del usuario; antes, formatos como PNG o JPG).
  const tipos = c.dataTypes.map((dt) => DATA_TYPE_LABELS[dt] ?? dt);
  const lugar =
    c.locationCity || c.locationState || c.todoElPais
      ? textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState })
      : "";
  const cierre = c.closedAt
    ? `cerró el ${new Date(c.closedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
    : "sin fecha de cierre";

  return (
    <Link
      href={`/datos/${c.id}`}
      className="landing-tarjeta grid h-full grid-cols-[96px_1fr] overflow-hidden rounded-[18px] border border-system-200 bg-white hover:border-brand-600 sm:grid-cols-[170px_1fr]"
    >
      <div className={`flex items-end bg-gradient-to-br p-3 ${PORTADAS[indice % PORTADAS.length]}`}>
        <span className="font-mono text-[11.5px] leading-snug text-white">{c.tematica || "Sin temática"}</span>
      </div>
      <div className="flex min-w-0 flex-col p-4">
        <p className="truncate text-[12.5px] text-system-600">
          {c.organizer}
          {detalle && ` · ${cierre}`}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 min-w-0 break-words text-[16px] font-semibold leading-snug text-system-900">{c.name}</h3>
          {detalle && c.verified && <Tag tone="ok">Verificado</Tag>}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tipos.map((tipo) => (
            <Tag key={tipo}>{tipo}</Tag>
          ))}
        </div>
        <p className="mt-auto pt-3 font-mono text-[11.5px] text-system-500">
          {nf.format(c.approvedContributions)} aportes · {c.sizeLabel} · {nf.format(c.downloads)} descargas
          {detalle && lugar ? ` · ${lugar}` : ""}
        </p>
      </div>
    </Link>
  );
}
