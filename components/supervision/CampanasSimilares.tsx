// "Campañas similares" (2026-11-04): las demás de la misma temática, para decidir si la campaña en revisión
// se acepta o se rechaza. Compartido por /supervision/[campaignId] y /supervisar/[campaignId] (`rutaBase`). Cada una abre
// su detalle en otra pestaña, para no perder la revisión; un supervisor no puede abrir una aceptada ajena
// (lib/campanas/visibilidad.ts) y ahí solo sale el nombre. Datos: lib/supervision/similares.ts.

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { fechaDDMMAAAA } from "@/lib/fecha-de-tepic";
import { PLURALES_DE_TIPO } from "@/lib/campanas/reparto-sugerido";
import type { CampanasSimilares as Similares } from "@/lib/supervision/similares";
import type { DataType } from "@/types";

export default function CampanasSimilares({
  similares,
  rutaBase,
}: {
  similares: Similares;
  rutaBase: "/supervision" | "/supervisar";
}) {
  const { tematica, total, campanas } = similares;

  return (
    <section aria-labelledby="campanas-similares" className="mt-5 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <h2 id="campanas-similares" className="text-[14px] font-bold text-system-900">
        Campañas similares <span className="font-mono text-system-600">({total})</span>
      </h2>
      <p className="mt-0.5 text-[12.5px] text-system-600">
        {total === 0
          ? `No hay otras campañas de ${tematica || "esta temática"} en el sistema.`
          : `De ${tematica}. Revísalas para decidir si esta campaña se acepta o se rechaza; si la rechazas por esto, explica el motivo.`}
      </p>
      {total > campanas.length && (
        <p className="mt-1 text-[12px] text-system-600">Se muestran {campanas.length} de {total}: primero las que siguen abiertas.</p>
      )}

      {campanas.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {campanas.map((campana) => {
            const etiqueta = ETIQUETA_DE_CAMPANA[campana.status as keyof typeof ETIQUETA_DE_CAMPANA];
            const puedeAbrirse = rutaBase === "/supervisar" || campana.status !== "aceptada";
            const lugar = textoDeUbicacion(
              { todoElPais: campana.todoElPais, municipio: campana.locationCity, estado: campana.locationState },
              "Sin ubicación",
            );
            const tipos = campana.dataTypes.map((t) => PLURALES_DE_TIPO[t as DataType]?.[1] ?? t).join(", ");
            return (
              <li key={campana.id} className="min-w-0 rounded-lg border border-system-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  {puedeAbrirse ? (
                    <Link
                      href={`${rutaBase}/${campana.id}`}
                      target="_blank"
                      className="min-w-0 break-words text-[13px] font-semibold text-brand-600 hover:underline"
                    >
                      {campana.name}
                    </Link>
                  ) : (
                    <p className="min-w-0 break-words text-[13px] font-semibold text-system-900">{campana.name}</p>
                  )}
                  <Tag tone={etiqueta?.tono ?? "default"}>{etiqueta?.texto ?? campana.status}</Tag>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-system-600">{campana.description}</p>
                <dl className="mt-2 space-y-0.5 text-[12px] text-system-600">
                  <div>
                    <dt className="inline">Organiza: </dt>
                    <dd className="inline text-system-900">{quienOrganiza(campana)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Lugar: </dt>
                    <dd className="inline text-system-900">{lugar}</dd>
                  </div>
                  {tipos && (
                    <div>
                      <dt className="inline">Recolecta: </dt>
                      <dd className="inline text-system-900">{tipos}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">Periodo: </dt>
                    <dd className="inline font-mono text-system-900">
                      {campana.startDate ? fechaDDMMAAAA(campana.startDate) : "sin fecha"} al {campana.endDate ? fechaDDMMAAAA(campana.endDate) : "sin fecha"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Avance: </dt>
                    <dd className="inline font-mono text-system-900">{campana.approvedContributions} / {campana.goalContributions} aprobados</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
