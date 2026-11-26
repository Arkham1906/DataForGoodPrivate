"use client";

// Opciones del enfoque como botones de radio con forma de tarjeta (RF-GAM-115). Lo usan el último paso de
// /bienvenida, la ventana para cuentas sin enfoque y la ventana para cambiarlo en Mi cuenta.
// «tarjetas»: tres columnas desde lg y filas en teléfono. «lista»: siempre en filas (dentro de una ventana angosta).

import type { OpcionDeEnfoque } from "@/lib/gamificacion/enfoque-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";

type Estilo = { icono: string; fondo: string; trazo: string; borde: string };

const ESTILOS: Record<string, Estilo> = {
  tracker: {
    icono: "M4 8h3l2-3h6l2 3h3v11H4z M8.5 13a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0",
    fondo: "bg-brand-50",
    trazo: "text-brand-700",
    borde: "has-[:checked]:border-brand-600",
  },
  collector: {
    icono: "M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5",
    fondo: "bg-success-50",
    trazo: "text-success-700",
    borde: "has-[:checked]:border-success-700",
  },
  explorer: {
    icono: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M15.5 8.5l-2 5-5 2 2-5z",
    fondo: "bg-warning-50",
    trazo: "text-warning-800",
    borde: "has-[:checked]:border-warning-700",
  },
};

/** Un enfoque nuevo del catálogo, sin estilo propio todavía. */
const ESTILO_COMUN: Estilo = {
  icono: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 8v8 M8 12h8",
  fondo: "bg-system-100",
  trazo: "text-system-700",
  borde: "has-[:checked]:border-brand-600",
};

export function estiloDeEnfoque(clave: string): Estilo {
  return ESTILOS[clave] ?? ESTILO_COMUN;
}

export function IconoDeEnfoque({ clave, className }: { clave: string; className: string }) {
  const estilo = estiloDeEnfoque(clave);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`${className} ${estilo.trazo}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={estilo.icono} />
    </svg>
  );
}

export default function SelectorDeEnfoque({
  nombre,
  opciones,
  valor,
  onCambiar,
  actual,
  forma = "tarjetas",
  deshabilitado = false,
}: {
  /** name de los radios: único por pantalla. */
  nombre: string;
  opciones: OpcionDeEnfoque[];
  valor: string | null;
  onCambiar: (clave: string) => void;
  /** Clave del enfoque que ya tiene la persona: se marca con «Tu enfoque actual». */
  actual?: string | null;
  forma?: "tarjetas" | "lista";
  deshabilitado?: boolean;
}) {
  const enTarjetas = forma === "tarjetas";
  return (
    <div className={enTarjetas ? "grid gap-3 lg:grid-cols-3 lg:gap-4" : "grid gap-2.5"}>
      {opciones.map((opcion) => {
        const estilo = estiloDeEnfoque(opcion.clave);
        const elegido = valor === opcion.clave;
        return (
          <label
            key={opcion.clave}
            className={`relative flex cursor-pointer gap-3.5 rounded-2xl border-2 border-system-200 bg-white p-3.5 transition-[border-color,box-shadow] hover:border-system-300 has-[:checked]:shadow-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${estilo.borde} ${
              enTarjetas ? "items-center pr-11 lg:flex-col lg:items-stretch lg:p-5" : "items-center pr-11"
            }`}
          >
            <input
              type="radio"
              name={nombre}
              value={opcion.clave}
              checked={elegido}
              disabled={deshabilitado}
              onChange={() => onCambiar(opcion.clave)}
              className="sr-only"
            />
            <span
              className={`grid shrink-0 place-items-center rounded-xl ${estilo.fondo} ${
                enTarjetas ? "size-13 lg:h-32 lg:w-full" : "size-13"
              }`}
            >
              <IconoDeEnfoque clave={opcion.clave} className={enTarjetas ? "size-7 lg:size-11" : "size-7"} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              {actual === opcion.clave && (
                <span className="text-[12px] font-bold text-success-700">{TEXTOS.enfoque.cambio.actual}</span>
              )}
              <span className={`font-extrabold text-system-900 ${enTarjetas ? "text-base lg:text-lg" : "text-base"}`}>{opcion.nombre}</span>
              <span className="text-[13px] leading-snug text-system-600">{opcion.subtitulo}</span>
            </span>
            {/* Círculo de la esquina: vacío o con palomita. Solo decorativo: el radio ya dice si está elegido. */}
            <span
              aria-hidden="true"
              className={`absolute right-3.5 top-3.5 grid size-5.5 place-items-center rounded-full border-2 ${
                elegido ? "border-transparent bg-success-700 text-white" : "border-system-300 bg-white"
              }`}
            >
              {elegido && (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Las dos líneas que van bajo la pregunta: para qué sirve y que no es la especialidad del perfil. */
export function ExplicacionDelEnfoque({ conElige = true }: { conElige?: boolean }) {
  const T = TEXTOS.enfoque;
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-system-600">
      {conElige && <p>{T.elige}</p>}
      <p>
        <strong className="font-bold text-system-900">{T.noEsEspecialidad}</strong> {T.diferencia}
      </p>
    </div>
  );
}
