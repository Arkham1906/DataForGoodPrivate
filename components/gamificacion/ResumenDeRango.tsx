// Resumen de rango de /inicio (la entrada a Mi progreso desde el 2026-11-12) (2026-11-02; SRS v1.1: RF-GAM-22, 23, 78): el avatar con su etapa, el
// rango actual, cuánto falta para el siguiente (barra de tramos y una frase) y el camino compacto de tres rangos.
// Server Component: todo lo que muestra viene de obtenerResumenDeProgreso() (lib/gamificacion/progreso.ts);
// la única parte con estado es CaminoCompacto (la ficha de rango). Hecho de piezas pequeñas para que un cambio
// al avatar, a la insignia o a la barra no toque este archivo (TarjetaDeAvatar, InsigniaDeRango, BarraDeRequisitos).

import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";
import type { ResumenDeProgreso } from "@/lib/gamificacion/progreso-tipos";
import BarraDeRequisitos from "./BarraDeRequisitos";
import CaminoCompacto from "./CaminoCompacto";
import TarjetaDeAvatar from "./TarjetaDeAvatar";

export default function ResumenDeRango({
  progreso,
  enlaces = {},
  idDelTitulo = "resumen-de-rango",
}: {
  progreso: ResumenDeProgreso;
  enlaces?: { trayectoria?: string; historial?: string; avatar?: string };
  /** id del título (aria-labelledby): cada pantalla usa el suyo. */
  idDelTitulo?: string;
}) {
  const { siguiente } = progreso;
  return (
    <section
      aria-labelledby={idDelTitulo}
      className="flex flex-wrap items-center gap-x-6 gap-y-5 rounded-lg border border-system-200 bg-white p-5 shadow-sm"
    >
      <TarjetaDeAvatar etapa={progreso.etapaDelAvatar} total={progreso.totalDeRangos} href={enlaces.avatar} />

      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5">
        <div>
          <p className="text-[13px] text-system-600">
            Tu rango · {progreso.rangoActual} de {progreso.totalDeRangos}
          </p>
          <h2 id={idDelTitulo} className="mt-0.5 text-2xl font-extrabold leading-tight text-system-900">
            {progreso.nombreDelRango}
          </h2>
        </div>

        {siguiente ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap justify-between gap-x-3 text-[13px]">
              <span className="text-system-900">
                Hacia <strong>{siguiente.nombre}</strong>
              </span>
              <span className="font-bold text-brand-700">
                {siguiente.cumplidos} de {siguiente.activos} requisitos
              </span>
            </div>
            <BarraDeRequisitos
              pasos={siguiente.pasos}
              etiqueta={`${siguiente.cumplidos} de ${siguiente.activos} requisitos cumplidos`}
            />
            <p className="text-[13px] text-system-600">{siguiente.textoQueFalta}</p>
          </div>
        ) : (
          <p className="text-[13px] text-system-600">Llegaste al último rango de la trayectoria. Es permanente.</p>
        )}
      </div>

      <div className="flex min-w-60 flex-[0_1_300px] flex-col items-start gap-3">
        <CaminoCompacto fichas={progreso.fichas} total={progreso.totalDeRangos} />
        {(enlaces.trayectoria || enlaces.historial) && (
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            {enlaces.trayectoria && (
              <ButtonLink href={enlaces.trayectoria} variant="secondary" size="sm">
                Ver tu trayectoria
              </ButtonLink>
            )}
            {enlaces.historial && (
              <Link href={enlaces.historial} className="text-[13px] font-semibold text-brand-600 hover:underline">
                Historial de EXP
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
