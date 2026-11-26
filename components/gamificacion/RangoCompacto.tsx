// Rango en una sola fila.
// Server Component: todo viene de obtenerResumenDeProgreso() (lib/gamificacion/progreso.ts).

import ButtonLink from "@/components/ui/ButtonLink";
import type { ResumenDeProgreso } from "@/lib/gamificacion/progreso-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import AvatarDeGamificacion from "./AvatarDeGamificacion";
import BarraDeRequisitos from "./BarraDeRequisitos";

const T = TEXTOS.resumen;

export default function RangoCompacto({
  progreso,
  enlace,
  idDelTitulo = "rango-compacto",
}: {
  progreso: ResumenDeProgreso;
  /** Pestaña Progreso; sin enlace no hay botón. */
  enlace: string | null;
  idDelTitulo?: string;
}) {
  const { siguiente } = progreso;
  return (
    <section
      aria-labelledby={idDelTitulo}
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-system-200 bg-white p-4 shadow-sm md:flex-nowrap md:px-5"
    >
      <div className="flex min-w-0 flex-[1_1_220px] items-center gap-3.5">
        <AvatarDeGamificacion etapa={progreso.etapaDelAvatar} tamano="md" />
        <div className="min-w-0">
          <p className="text-[12.5px] text-system-600">
            {T.rango(progreso.rangoActual, progreso.totalDeRangos)} · {T.etapa(progreso.etapaDelAvatar)}
          </p>
          <h2 id={idDelTitulo} className="text-lg font-extrabold leading-tight text-system-900">
            {progreso.nombreDelRango}
          </h2>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1.4_1_260px] flex-col gap-1.5">
        {siguiente ? (
          <>
            <p className="flex flex-wrap justify-between gap-x-3 text-[13px]">
              <span className="text-system-700">{T.paraCompletar}</span>
              <strong className="text-brand-700">{T.requisitos(siguiente.cumplidos, siguiente.activos)}</strong>
            </p>
            <BarraDeRequisitos
              pasos={siguiente.pasos}
              etiqueta={`${T.requisitos(siguiente.cumplidos, siguiente.activos)} cumplidos`}
            />
            <p className="text-[12.5px] text-system-600">
              {siguiente.textoQueFalta} {T.luegoPasas(siguiente.numero)}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-system-600">{T.ultimoRango}</p>
        )}
      </div>

      {enlace && (
        <ButtonLink href={enlace} variant="secondary" size="sm" className="max-md:w-full max-md:justify-center">
          {T.verProgreso}
        </ButtonLink>
      )}
    </section>
  );
}
