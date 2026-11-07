// "Campañas similares" (2026-11-04): las que se parecen por temática, subtemática, nombre, descripción o
// tipos de dato (2026-11-07), para decidir si la campaña en revisión se acepta o se rechaza. Compartido por /supervision/[campaignId] y /supervisar/[campaignId] (`rutaBase`). Cada una abre
// su detalle en otra pestaña, para no perder la revisión; un supervisor no puede abrir una programada ajena
// (lib/campanas/visibilidad.ts) y ahí solo sale el nombre. Datos: lib/supervision/similares.ts.

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { fechaDDMMAAAA } from "@/lib/fecha-de-tepic";
import { PLURALES_DE_TIPO } from "@/lib/campanas/reparto-sugerido";
import { NOMBRE_DE_COINCIDENCIA } from "@/lib/supervision/parecido";
import type { CampanasSimilares as Similares } from "@/lib/supervision/similares";
import type { DataType } from "@/types";

export default function CampanasSimilares({
  similares,
  rutaBase,
}: {
  similares: Similares;
  rutaBase: "/supervision" | "/supervisar";
}) {
  const { total, campanas } = similares;

  return (
    <section aria-labelledby="campanas-similares" className="mt-5 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <h2 id="campanas-similares" className="text-[14px] font-bold text-system-900">
        Campañas similares <span className="font-mono text-system-600">({total})</span>
      </h2>
      <p className="mt-0.5 text-[12.5px] text-system-600">
        {total === 0
          ? "No hay otras campañas parecidas en el sistema."
          : "Por temática, subtemática, nombre, descripción o tipos de dato, de la más parecida a la menos. Revísalas para decidir si esta campaña se acepta o se rechaza; si la rechazas por esto, explica el motivo."}
      </p>
      {total > campanas.length && (
        <p className="mt-1 text-[12px] text-system-600">Se muestran {campanas.length} de {total}: primero las más parecidas.</p>
      )}

      {campanas.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {campanas.map((campana) => {
            const etiqueta = ETIQUETA_DE_CAMPANA[campana.status as keyof typeof ETIQUETA_DE_CAMPANA];
            // En este card, una aceptada se llama por lo que es: aún no empieza (a pedido del usuario).
            const estado = campana.status === "aceptada" ? "Programada" : etiqueta?.texto ?? campana.status;
            const puedeAbrirse = rutaBase === "/supervisar" || campana.status !== "aceptada";
            const lugar = textoDeUbicacion(
              { todoElPais: campana.todoElPais, municipio: campana.locationCity, estado: campana.locationState },
              "Sin ubicación",
            );
            const tipos = campana.dataTypes.map((t) => PLURALES_DE_TIPO[t as DataType]?.[1] ?? t).join(", ");
            return (
              <li key={campana.id} className="min-w-0 rounded-lg border border-system-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[12px] text-system-600">
                    Coincide en:{" "}
                    <span className="font-semibold text-system-900">
                      {campana.coincidencias.map((c) => NOMBRE_DE_COINCIDENCIA[c]).join(", ")}
                    </span>
                  </p>
                  <span className="shrink-0"><Tag tone={etiqueta?.tono ?? "default"}>{estado}</Tag></span>
                </div>
                <dl className="mt-2 space-y-1 border-b border-system-100 pb-2 text-[12.5px] text-system-600">
                  <div>
                    <dt className="inline">Temática principal: </dt>
                    <dd className="inline text-system-900">{campana.tematica || "Sin temática"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Subtemática: </dt>
                    <dd className="inline text-system-900">{campana.etiquetas.join(", ") || "Sin subtemática"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Nombre: </dt>
                    <dd className="inline break-words">
                      {puedeAbrirse ? (
                        <Link href={`${rutaBase}/${campana.id}`} target="_blank" className="font-semibold text-brand-600 hover:underline">
                          {campana.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-system-900">{campana.name}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Descripción: </dt>
                    <dd className="inline break-words text-system-900">{campana.description || "Sin descripción"}</dd>
                  </div>
                  <div>
                    <dt className="inline">Tipo de dato: </dt>
                    <dd className="inline text-system-900">{tipos || "Sin tipos de dato"}</dd>
                  </div>
                </dl>
                <dl className="mt-2 space-y-0.5 text-[12px] text-system-600">
                  <div>
                    <dt className="inline">Organiza: </dt>
                    <dd className="inline text-system-900">{quienOrganiza(campana)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Lugar: </dt>
                    <dd className="inline text-system-900">{lugar}</dd>
                  </div>
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
