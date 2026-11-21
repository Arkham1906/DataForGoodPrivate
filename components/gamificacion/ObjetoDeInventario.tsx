// Protector y potenciador (2026-11-20; lienzo «Misiones: Envía/Logra, dificultad y recompensa», tableros de objetos,
// aprobados el mismo día): escudo naranja con llama y frasco azul. De 48 px para arriba va la ilustración
// (public/gamificacion/v1/objetos); en 24 px o menos, el glifo (chips de la tarjeta de misión, calendario, celebración).
// Siempre decorativos: el texto de al lado dice qué es.

import { imagenDeObjeto, type LadoDeObjeto } from "@/lib/gamificacion/recursos";

export type Objeto = "protector" | "potenciador";

const GLIFOS: Record<Objeto, string[]> = {
  protector: [
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "M12 8.5c.9 1.8 2.6 2.8 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.3.8-2.1 1.2-3 .3.9.7 1.2 1.1 1.2-.4-1.1-.2-2.2.3-3.2z",
  ],
  potenciador: ["M9.5 3h5M10 3v5.2A6.5 6.5 0 1 0 14 8.2V3", "M12.8 12l-2.2 3.4h2.6l-1.6 3"],
};

export function GlifoDeObjeto({ objeto, className }: { objeto: Objeto; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLIFOS[objeto].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** La ilustración. `lado` es el archivo que se pide (el doble del tamaño en pantalla, para pantallas densas). */
export function ImagenDeObjeto({
  objeto,
  tamano,
  lado = 192,
  className = "",
}: {
  objeto: Objeto;
  tamano: number;
  lado?: LadoDeObjeto;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen fija y pequeña, como las de misiones y medallas
    <img src={imagenDeObjeto(objeto, lado)} alt="" width={tamano} height={tamano} className={className} draggable={false} />
  );
}
