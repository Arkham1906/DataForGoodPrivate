"use client";

// Potenciador activo en el menú lateral (2026-11-23; lienzo «Potenciador fuera de Mi progreso», aprobado el mismo día;
// RF-GAM-32 a 36): el tiempo que queda, lo que suma y cuántos esperan. Solo aparece con un potenciador activo y solo en
// escritorio (en teléfono va la burbuja, BurbujaDelPotenciador). Sin enlace: es el único lugar donde se ve.
// Al llegar a 0 se desvanece mientras el servidor activa el siguiente o lo quita.

import type { ResumenDePotenciadores } from "@/lib/gamificacion/progreso-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import AnilloDelPotenciador from "./AnilloDelPotenciador";
import { useSegundosDelPotenciador } from "./useSegundosDelPotenciador";

const T = TEXTOS.potenciadorFlotante;

export default function PotenciadorDelMenu({ potenciadores }: { potenciadores: ResumenDePotenciadores | null }) {
  const activo = potenciadores?.activo ?? null;
  const segundos = useSegundosDelPotenciador(activo);
  if (!potenciadores || !activo) return null;
  return (
    <section
      aria-labelledby="potenciador-del-menu"
      className={`potenciador-entra mt-4 rounded-lg border border-brand-100 bg-brand-50 p-3 transition-opacity duration-300 max-md:hidden ${
        segundos === 0 ? "opacity-0" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <AnilloDelPotenciador segundos={segundos} duracionMinutos={activo.duracionMinutos} lado={52} />
        <div>
          <h2 id="potenciador-del-menu" className="text-[12.5px] font-bold text-brand-800">
            {T.titulo}
          </h2>
          <p role="timer" aria-label={T.quedan(segundos)} className="font-mono text-[22px] font-extrabold leading-tight text-system-900">
            {T.reloj(segundos)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-brand-800">
        {T.suma(activo.bonificacion)}
        {potenciadores.enEspera > 0 && ` ${T.enEspera(potenciadores.enEspera)}`}
      </p>
    </section>
  );
}
