// Piezas comunes de las celebraciones (2026-11-16; claude/pantallas-v12/celebracion-propuesta.md): retraso de cada
// pieza (--d), iconos, la llama animada y los botones. Las animaciones viven en app/globals.css (sección «Celebraciones»).
// Sin estado: sirven en cualquier componente cliente.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/** Retraso de una pieza de la secuencia, en ms (lo lee la clase cel-* en globals.css). */
export const retraso = (ms: number, extra?: CSSProperties): CSSProperties => ({ ["--d" as string]: `${ms}ms`, ...extra });

export const TRAZOS = {
  usuario: "M7 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M20 21a8 8 0 0 0-16 0",
  insignia:
    "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15 M11 12 5.12 2.2 M13 12 l5.88-9.8 M8 7h8 M7 17a5 5 0 1 0 10 0a5 5 0 1 0 -10 0",
  regalo:
    "M12 7v14 M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8 M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5 M4 7h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z",
  ojo: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0 M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  palomita: "M20 6 9 17l-5-5",
  bandera: "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528",
} as const;

export function Icono({ trazo, className = "h-5 w-5", grosor = 1.9 }: { trazo: string; className?: string; grosor?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round">
      <path d={trazo} />
    </svg>
  );
}

const LLAMA = {
  exterior: "M60 6C70 34 98 50 98 88c0 28-18 46-38 46S22 116 22 88c0-22 12-34 18-48 4 18 12 22 16 22-6-20-4-40 4-56Z",
  media: "M60 44c6 18 24 30 24 54 0 20-12 30-24 30S36 118 36 98c0-14 8-22 12-30 2 12 8 16 12 16-4-14-4-28 0-40Z",
  centro: "M60 80c4 12 14 20 14 32 0 10-6 16-14 16s-14-6-14-16c0-10 8-16 14-32Z",
};

/** Llama de tres capas que parpadean a ritmos distintos. `apagada`: la llama gris de una racha perdida (sin parpadeo). */
export function Llama({ ancho, apagada = false }: { ancho: number; apagada?: boolean }) {
  const alto = Math.round((ancho * 140) / 120);
  if (apagada) {
    return (
      <svg viewBox="0 0 120 140" width={ancho} height={alto} aria-hidden="true" focusable="false">
        <path fill="#c9c5be" d={LLAMA.exterior} />
        <path fill="#e2ded7" d={LLAMA.media} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 140" width={ancho} height={alto} aria-hidden="true" focusable="false" className="overflow-visible">
      <path className="cel-capa cel-capa-1" fill="var(--fuego-600)" d={LLAMA.exterior} />
      <path className="cel-capa cel-capa-2" fill="var(--fuego-400)" d={LLAMA.media} />
      <path className="cel-capa cel-capa-3" fill="var(--color-warning-300)" d={LLAMA.centro} />
    </svg>
  );
}

/** Brasas que suben desde la llama, en bucle. `arriba`: distancia desde el borde superior del escenario. */
export function Brasas({ desde, arriba, inicio }: { desde: number; arriba: number; inicio: number }) {
  const colores = ["var(--fuego-400)", "var(--color-warning-300)", "var(--fuego-600)", "var(--fuego-300)"];
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const lado = 4 + (i % 3) * 2;
        return (
          <span
            key={i}
            aria-hidden="true"
            className="cel-solo-mov cel-brasa absolute rounded-full"
            style={retraso(inicio + i * 210, {
              left: desde + ((i * 13) % 80),
              top: arriba,
              width: lado,
              height: lado,
              background: colores[i % 4],
              ["--dx" as string]: `${(i % 2 ? 1 : -1) * (8 + ((i * 7) % 22))}px`,
            })}
          />
        );
      })}
    </>
  );
}

/** «1 de 2» en la esquina, solo si hay más de un paso. */
export function Paso({ texto, tono }: { texto: string | null; tono: "oscuro" | "fuego" | "claro" }) {
  if (!texto) return null;
  const colores = {
    oscuro: "border-brand-800 text-brand-300",
    fuego: "border-[var(--fuego-200)] text-[var(--fuego-800)]",
    claro: "border-system-300 text-system-600",
  }[tono];
  return <span className={`absolute right-4 top-4 rounded-pill border px-3 py-1 text-[12.5px] font-bold md:right-6 md:top-5 ${colores}`}>{texto}</span>;
}

const BOTON =
  "inline-flex min-h-12 items-center justify-center rounded-pill px-6 text-[15px] font-bold transition-transform duration-150 ease-salida active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2";

export type TonoDeBoton = "principal" | "claro" | "oscuro";

const TONOS: Record<TonoDeBoton, string> = {
  principal: "bg-success-700 text-white hover:bg-success-800 focus-visible:outline-brand-600",
  claro: "border border-system-300 bg-white text-system-900 hover:bg-system-100 focus-visible:outline-brand-600",
  oscuro: "border border-white/35 text-white hover:bg-white/10 focus-visible:outline-brand-200",
};

/** Botón o enlace de una celebración. `foco`: el que recibe el foco al abrirse. */
export function Accion({
  tono,
  alPulsar,
  href,
  foco,
  children,
}: {
  tono: TonoDeBoton;
  alPulsar: () => void;
  href?: string | null;
  foco?: boolean;
  children: ReactNode;
}) {
  const clase = `${BOTON} ${TONOS[tono]}`;
  if (href)
    return (
      <Link href={href} onClick={alPulsar} className={clase} data-foco={foco ? "" : undefined}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={alPulsar} className={clase} data-foco={foco ? "" : undefined}>
      {children}
    </button>
  );
}
