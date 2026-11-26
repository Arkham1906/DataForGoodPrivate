// Anillo del tiempo que queda con el frasco al centro (2026-11-23; el mismo dibujo de PotenciadorActivo). El anillo baja
// una vez por minuto: se dibuja con los minutos que quedan, no con los segundos, para que no se mueva todo el tiempo.

import { ImagenDeObjeto } from "./ObjetoDeInventario";

const RADIO = 20;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export default function AnilloDelPotenciador({
  segundos,
  duracionMinutos,
  lado,
  clasePista = "stroke-white",
}: {
  segundos: number;
  duracionMinutos: number;
  /** Lado en px del anillo; el frasco ocupa dos tercios. */
  lado: number;
  clasePista?: string;
}) {
  const fraccion = Math.min(1, Math.ceil(segundos / 60) / Math.max(1, duracionMinutos));
  const frasco = Math.round(lado * 0.66);
  return (
    <span className="relative block shrink-0" style={{ width: lado, height: lado }}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="absolute inset-0 -rotate-90" width={lado} height={lado}>
        <circle cx="24" cy="24" r={RADIO} fill="none" strokeWidth="3" className={clasePista} />
        <circle
          cx="24"
          cy="24"
          r={RADIO}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-brand-700"
          strokeDasharray={`${CIRCUNFERENCIA * fraccion} ${CIRCUNFERENCIA}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <ImagenDeObjeto objeto="potenciador" tamano={frasco} lado={96} className="block" />
      </span>
    </span>
  );
}
