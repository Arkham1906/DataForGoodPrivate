"use client";

// Etiquetas de la ficha de un conjunto abierto (/datos/[id]) con su explicación (2026-11-11, a pedido
// del usuario): temática, licencia y ubicación muestran qué son al pasar el cursor, al enfocarlas con el
// teclado o al tocarlas en el celular (no hay "pasar el cursor"). La licencia además es un botón que
// despliega debajo qué es CC BY 4.0, qué permite y cómo citar el conjunto, con el enlace a la licencia.

import { useId, useState, type ReactNode } from "react";

const ENLACE_DE_LA_LICENCIA = "https://creativecommons.org/licenses/by/4.0/deed.es";

const ETIQUETA = "inline-flex items-center gap-1 rounded-pill border border-system-300 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-system-600";

// Hacia dónde se abre el aviso: la primera etiqueta está pegada al borde izquierdo y la última puede
// quedar cerca del derecho en un celular; centrado se saldría de la pantalla.
const LADO = {
  izquierda: { caja: "left-0", flecha: "left-4" },
  centro: { caja: "left-1/2 -translate-x-1/2", flecha: "left-1/2 -translate-x-1/2" },
  derecha: { caja: "right-0", flecha: "right-4" },
} as const;

/** Etiqueta con un aviso que aparece encima al pasar el cursor o al enfocarla. */
function ConAyuda({
  ayuda,
  lado = "centro",
  children,
}: {
  ayuda: string;
  lado?: keyof typeof LADO;
  children: (props: { "aria-describedby": string }) => ReactNode;
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      {children({ "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none invisible absolute bottom-full z-20 mb-2 w-max max-w-[min(240px,75vw)] rounded-md bg-system-900 px-2.5 py-1.5 text-left text-[11.5px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none ${LADO[lado].caja}`}
      >
        {ayuda}
        <span aria-hidden="true" className={`absolute top-full border-4 border-transparent border-t-system-900 ${LADO[lado].flecha}`} />
      </span>
    </span>
  );
}

export default function EtiquetasDelConjunto({
  tematica,
  licencia,
  ubicacion,
  todoElPais,
  nombre,
}: {
  tematica: string | null;
  licencia: string;
  ubicacion: string | null;
  todoElPais: boolean;
  /** Nombre de la campaña, para la cita sugerida. */
  nombre: string;
}) {
  const [licenciaAbierta, setLicenciaAbierta] = useState(false);
  const idDelPanel = useId();

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <ConAyuda lado="izquierda" ayuda="Temática: el tema de la campaña que reunió estos datos.">
          {(ayuda) => (
            <span tabIndex={0} {...ayuda} className={`${ETIQUETA} cursor-help outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600`}>
              {tematica || "Sin temática"}
            </span>
          )}
        </ConAyuda>

        <ConAyuda
          ayuda={
            licenciaAbierta
              ? "Licencia de uso de los datos. Haz clic para ocultar la explicación."
              : "Licencia de uso de los datos. Haz clic para ver qué permite."
          }
        >
          {(ayuda) => (
            <button
              type="button"
              {...ayuda}
              aria-expanded={licenciaAbierta}
              aria-controls={idDelPanel}
              onClick={() => setLicenciaAbierta((v) => !v)}
              className={`${ETIQUETA} cursor-pointer transition-colors hover:border-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${licenciaAbierta ? "border-brand-600 bg-brand-50 text-brand-800" : ""}`}
            >
              {licencia}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={`h-3 w-3 transition-transform motion-reduce:transition-none ${licenciaAbierta ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </ConAyuda>

        {ubicacion ? (
          <ConAyuda
            lado="derecha"
            ayuda={
              todoElPais
                ? "Ubicación: la campaña recibió aportes de todo el país."
                : "Ubicación: dónde se recolectaron los datos de esta campaña."
            }
          >
            {(ayuda) => (
              <span tabIndex={0} {...ayuda} className={`${ETIQUETA} cursor-help outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600`}>
                {ubicacion}
              </span>
            )}
          </ConAyuda>
        ) : null}
      </div>

      {licenciaAbierta ? (
        <section
          id={idDelPanel}
          aria-label={`Qué es la licencia ${licencia}`}
          className="mt-3 max-w-2xl rounded-lg border border-system-200 border-l-4 border-l-brand-600 bg-white p-4 text-[13px] leading-relaxed text-system-600"
        >
          <p className="font-semibold text-system-900">{licencia}: Creative Commons Atribución 4.0 Internacional</p>
          <p className="mt-1.5">
            Es una licencia abierta: cualquiera puede usar estos datos, también con fines comerciales, siempre que diga de dónde salieron.
          </p>
          <p className="mt-3 font-semibold text-system-900">Puedes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-system-900">Compartir:</span> copiar y redistribuir los datos en cualquier medio o formato.
            </li>
            <li>
              <span className="font-medium text-system-900">Adaptar:</span> combinarlos, transformarlos y crear a partir de ellos.
            </li>
          </ul>
          <p className="mt-3 font-semibold text-system-900">Con una condición</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-system-900">Atribución:</span> dar el crédito correspondiente, poner el enlace a la licencia e indicar si hiciste cambios.
            </li>
          </ul>
          <p className="mt-3 font-semibold text-system-900">Cómo citarlo</p>
          <p className="mt-1 rounded bg-system-100 px-3 py-2 font-mono text-[12px] text-system-800">
            «{nombre}», DataForGood. Licencia {licencia}.
          </p>
          <a
            href={ENLACE_DE_LA_LICENCIA}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block font-semibold text-brand-600 hover:underline"
          >
            Leer la licencia completa en Creative Commons ↗
          </a>
        </section>
      ) : null}
    </>
  );
}
