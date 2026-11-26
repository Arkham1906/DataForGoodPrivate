// Lista del listado de campañas del panel, /sistema/campanas (2026-11-26, a pedido del usuario: "el tipo de lista que se
// ve en modo supervisor"). Copia la vista de lista de las tarjetas de /supervisar (app/(panel)/supervisar/pestanas.tsx,
// de Gerard): por campaña, una tarjeta que abre su ficha (/sistema/campanas/[id]) con banner de 48 px, nombre, estado y
// temática; supervisa, creador y ubicación; meta, aprobados, participantes y cierre; tipos de dato.
// Solo lista (el mismo día, a pedido del usuario): sin "Vista" ni el selector lista/cuadrícula de /supervisar.
// /supervisar sigue con su propia copia (Gerard la cambia seguido); si se cambia el diseño, cambiarlo en las dos.
// Solo escritorio: en el teléfono /sistema/campanas conserva sus tarjetas (md:hidden; el responsivo es de Gerard).
// Sin estado ni efectos: sirve en el Server Component de la página.

import Link from "next/link";

import Tag from "@/components/ui/Tag";
import { BASE_PATH } from "@/lib/base-path";
import { ETIQUETA_DE_CAMPANA, NOMBRE_DE_TIPO, formatearFechaCampana, type FilaDeCampana } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";

const CLASE_TARJETA =
  "grid min-w-0 grid-cols-1 items-center gap-x-5 gap-y-3 rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-shadow hover:border-brand-600 hover:shadow-md md:grid-cols-[minmax(0,1.3fr)_minmax(160px,1.2fr)_minmax(96px,0.7fr)_minmax(140px,1fr)] md:gap-x-4 xl:grid-cols-[minmax(190px,1.3fr)_minmax(200px,1.2fr)_minmax(110px,0.7fr)_minmax(160px,1fr)] xl:gap-x-5";

function TarjetaDeCampana({ c }: { c: FilaDeCampana }) {
  const estado = ETIQUETA_DE_CAMPANA[c.estado];
  const supervisa = c.supervisadaPor || "Sin asignar";
  const creador = c.creador || "Usuario";
  const ubicacion = textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.municipio, estado: c.estadoGeografico }, "Sin ubicación");
  const cierre = c.venceEn ? `Cierra el ${formatearFechaCampana(c.venceEn, false)}` : "Sin fecha de cierre";

  return (
    <li>
      <Link href={`/sistema/campanas/${c.id}`} className={CLASE_TARJETA}>
        <div className="flex min-w-0 items-center justify-start gap-3 md:pr-8 xl:pr-14">
          {c.hasBanner ? (
            <div data-campana-banner className="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-system-100 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element -- el banner conserva el encuadre elegido para la campaña. */}
              <img
                src={`${BASE_PATH}/api/campanas/${c.id}/banner?v=${encodeURIComponent(c.bannerVersion ?? "")}`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                style={{ objectPosition: `${c.bannerPositionX}% ${c.bannerPositionY}%`, transform: `scale(${c.bannerScale})` }}
              />
            </div>
          ) : (
            <div className="hidden h-12 w-12 shrink-0 md:block" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h2 className="min-w-0 break-words text-[15px] font-extrabold text-system-900">{c.nombre}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Tag tone={estado.tono}>{estado.texto}</Tag>
            </div>
            {c.tematica && (
              <div className="mt-2">
                <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{c.tematica}</Tag>
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-1 text-[11px] text-system-600">
          <p>Supervisa: {supervisa}</p>
          <p className="truncate" title={creador}>
            <span className="font-semibold text-system-700">Creador:</span> {creador}
          </p>
          <p className="truncate" title={ubicacion}>
            <span className="font-semibold text-system-700">Ubicación:</span> {ubicacion}
          </p>
        </div>
        <div className="min-w-0 text-[11px] text-system-600">
          <p className="font-semibold text-system-700">Meta total:</p>
          <p className="font-mono">{c.meta.toLocaleString("es-MX")} aportes</p>
          <p className="mt-1">
            {c.aprobados} aprobados · {c.participantes} {c.participantes === 1 ? "participante" : "participantes"}
          </p>
          <p className="text-system-500">{cierre}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold text-system-700">Tipo de dato:</p>
          <div className="flex flex-wrap gap-1.5">
            {c.tiposDeDato.length > 0 ? (
              c.tiposDeDato.map((t) => <Tag key={t}>{NOMBRE_DE_TIPO[t]}</Tag>)
            ) : (
              <span className="text-[11px] text-system-500">—</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function ListaDeCampanasDelPanel({ filas }: { filas: FilaDeCampana[] }) {
  return (
    <ul aria-label="Campañas" className="hidden flex-col gap-3 md:flex">
      {filas.map((c) => (
        <TarjetaDeCampana key={c.id} c={c} />
      ))}
    </ul>
  );
}
