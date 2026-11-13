// «Hoy» de /inicio (2026-11-02; SRS v1.1): tres zonas sobre un fondo azul claro, con el potenciador,
// las misiones diarias y la racha. Solo compone: cada zona vive en su componente (PotenciadorActivo, MisionesDeHoy,
// RachaSemanal) para que un cambio en una no toque a las otras. Server Component; la única parte con estado es
// PotenciadorActivo (su cuenta regresiva).

import type { ReactNode } from "react";
import type { ResumenDeProgreso } from "@/lib/gamificacion/progreso-tipos";
import MisionesDeHoy from "./MisionesDeHoy";
import PotenciadorActivo from "./PotenciadorActivo";
import RachaSemanal from "./RachaSemanal";

const ZONA = "flex min-w-0 flex-col gap-2.5 p-5";

export default function ResumenDeHoy({
  progreso,
  accionDeRacha,
}: {
  progreso: ResumenDeProgreso;
  /** Debajo de la racha; /inicio pone ahí el calendario (CalendarioDeRacha). */
  accionDeRacha?: ReactNode;
}) {
  return (
    <section
      aria-label="Hoy"
      className="flex flex-col divide-y divide-brand-300/50 overflow-hidden rounded-lg bg-brand-100 lg:flex-row lg:divide-x lg:divide-y-0"
    >
      <div className={`${ZONA} lg:flex-1`}>
        <PotenciadorActivo potenciadores={progreso.potenciadores} />
      </div>
      <div className={`${ZONA} lg:flex-[1.6]`}>
        <MisionesDeHoy misiones={progreso.misiones} />
      </div>
      <div className={`${ZONA} lg:flex-1`}>
        <RachaSemanal racha={progreso.racha} accion={accionDeRacha} />
      </div>
    </section>
  );
}
