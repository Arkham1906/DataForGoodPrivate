// «Medallas cerca de subir» del Resumen de /progreso (2026-11-04; diseño v10, RF-GAM-46 a 49): las tres medallas con
// menos camino hacia su siguiente nivel (medallasMasCercanas). Sin estado: Server Component.
// «Ver tus medallas» aparece cuando exista esa pantalla (lib/gamificacion/pantallas-de-progreso.ts).

import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
import type { MedallaCercaDeSubir } from "@/lib/gamificacion/medallas";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";

const nf = new Intl.NumberFormat("es-MX");

export default function MedallasCercaDeSubir({ medallas }: { medallas: MedallaCercaDeSubir[] }) {
  const pantalla = rutaDePantalla("medallas");
  return (
    <section aria-labelledby="progreso-medallas" className="flex min-w-0 flex-col gap-3 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-x-2.5 gap-y-1">
        <h2 id="progreso-medallas" className="text-lg font-extrabold text-system-900">
          Medallas cerca de subir
        </h2>
        {pantalla && (
          <Link href={pantalla} className="text-[13px] font-semibold text-brand-600 hover:underline">
            Ver tus medallas →
          </Link>
        )}
      </div>
      {medallas.length === 0 ? (
        <p className="text-[13px] text-system-600">Tus medallas están en su nivel más alto.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {medallas.map((m) => (
            <li key={m.clave} className="flex flex-col gap-1.5">
              <p className="flex flex-wrap justify-between gap-x-2.5 text-[13.5px] text-system-900">
                <span>
                  <strong>{m.nombre}</strong> · {m.nivelActual ? `${m.nivelActual} → ${m.nivelSiguiente}` : m.nivelSiguiente}
                </span>
                <span className="font-mono text-[12.5px] text-system-700">
                  {nf.format(m.valor)} de {nf.format(m.umbral)}
                </span>
              </p>
              <ProgressBar pct={m.porcentaje} />
              {m.queMide && <p className="text-[12px] text-system-600">{m.queMide}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
