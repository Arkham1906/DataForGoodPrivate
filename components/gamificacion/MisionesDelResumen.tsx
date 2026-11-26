// Misiones del Resumen de Mi progreso .
//  Solo las 2 más cerca de completarse entre las diarias y las semanales sin completar,
// cada una con su periodo y cuándo termina; arriba, cuántas llevas de cada periodo. El resto
// y el detalle (cuándo cuenta cada una, el historial) quedan en la pestaña Misiones.
// Server Component. Datos: obtenerMisiones() (lib/gamificacion/misiones.ts), los mismos de la pestaña Misiones.

import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
import { colorDeAvance, fondoDeAvance } from "@/lib/gamificacion/color-de-avance";
import type { GrupoDeMisiones, MisionVigente } from "@/lib/gamificacion/misiones";
import { TEXTOS } from "@/lib/gamificacion/textos";
import IconoDeMision from "./IconoDeMision";

const T = TEXTOS.resumen.misiones;

/** Cuántas misiones muestra el Resumen. */
const MISIONES_A_MOSTRAR = 2;
/** Hasta cuántos pasos se dibujan como tramos; con más, una barra continua (igual que en la pestaña Misiones). */
const MAXIMO_DE_TRAMOS = 5;

type Candidata = { m: MisionVigente; periodo: "diaria" | "semanal"; terminaEn: string | null };

/**
 * Las más cerca de completarse: mayor fracción hecha; a igual fracción, menos pasos que faltan; a igual, la diaria
 * (su periodo es más corto). Las completadas no entran.
 */
export function masCercaDeCompletarse(diarias: GrupoDeMisiones, semanales: GrupoDeMisiones, cuantas: number): Candidata[] {
  const candidatas: Candidata[] = [
    ...diarias.misiones.map((m) => ({ m, periodo: "diaria" as const, terminaEn: diarias.seRenuevanEn })),
    ...semanales.misiones.map((m) => ({ m, periodo: "semanal" as const, terminaEn: semanales.seRenuevanEn })),
  ].filter(({ m }) => !m.completada);
  const fraccion = (m: MisionVigente) => Math.min(m.progreso, m.objetivo) / Math.max(1, m.objetivo);
  const faltan = (m: MisionVigente) => Math.max(0, m.objetivo - m.progreso);
  return candidatas
    .sort(
      (a, b) =>
        fraccion(b.m) - fraccion(a.m) ||
        faltan(a.m) - faltan(b.m) ||
        (a.periodo === b.periodo ? 0 : a.periodo === "diaria" ? -1 : 1),
    )
    .slice(0, cuantas);
}

function Fila({ m, periodo, terminaEn }: Candidata) {
  const hechos = Math.min(m.progreso, m.objetivo);
  const fraccion = hechos / Math.max(1, m.objetivo);
  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="row-span-3">
        <IconoDeMision clave={m.clave} completada={false} tamano={40} />
      </span>
      <span className="min-w-0 text-sm font-semibold text-system-900">
        {m.nombre}
        {m.dificil && (
          <span className="ml-1.5 inline-block rounded-pill bg-brand-950 px-2 py-0.5 align-[1px] text-[11px] font-bold text-white">
            {T.dificil}
          </span>
        )}
      </span>
      <span className="text-right text-[12.5px] font-bold text-system-700">
        {T.avance(hechos, m.objetivo)}
        {m.recompensa && <span className="font-semibold text-system-600 max-sm:hidden"> · {m.recompensa}</span>}
      </span>
      <div className="col-span-2" aria-hidden="true">
        {m.objetivo <= MAXIMO_DE_TRAMOS ? (
          <div className="flex gap-1">
            {Array.from({ length: m.objetivo }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-pill ${i < hechos ? "" : "bg-system-200"}`}
                style={i < hechos ? { background: colorDeAvance(fraccion) } : undefined}
              />
            ))}
          </div>
        ) : (
          <ProgressBar pct={fraccion * 100} color={fondoDeAvance(fraccion)} />
        )}
      </div>
      <p className="col-span-2 text-[12px] text-system-600">
        {periodo === "diaria" ? T.diaria : T.semanal}
        {terminaEn && ` · ${T.terminaEn(terminaEn)}`}
      </p>
    </li>
  );
}

export default function MisionesDelResumen({
  diarias,
  semanales,
  enlace,
}: {
  diarias: GrupoDeMisiones;
  semanales: GrupoDeMisiones;
  enlace: string | null;
}) {
  const hechas = (g: GrupoDeMisiones) => g.misiones.filter((m) => m.completada).length;
  const total = diarias.misiones.length + semanales.misiones.length;
  const proximas = masCercaDeCompletarse(diarias, semanales, MISIONES_A_MOSTRAR);
  return (
    <section aria-labelledby="resumen-misiones" className="flex min-w-0 flex-col gap-4 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="resumen-misiones" className="text-lg font-extrabold text-system-900">
            {T.titulo}
          </h2>
          {enlace && (
            <Link href={enlace} className="text-[13px] font-semibold text-brand-700 hover:underline">
              {T.verTodas}
            </Link>
          )}
        </div>
        {total > 0 && (
          <p className="text-[12.5px] text-system-600">
            {T.cuenta(hechas(diarias), diarias.misiones.length, hechas(semanales), semanales.misiones.length)}
          </p>
        )}
      </div>
      {total === 0 ? (
        <p className="text-[13px] text-system-600">{T.sinMisiones}</p>
      ) : proximas.length === 0 ? (
        <p className="text-[13px] font-semibold text-success-800">{T.todasCompletas}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-bold text-system-700">{T.masCerca(proximas.length)}</h3>
          <ul className="flex flex-col gap-4">
            {proximas.map((c) => (
              <Fila key={c.m.id} {...c} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
