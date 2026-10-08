"use client";

// Logo de DataForGood: el ícono (cuadrícula de public/logo.svg) y la palabra (trazos de
// public/Texto.svg), dibujados aquí para animarlos y tomar los colores del tema.
// Al pasar el cursor, "ata", "or" y "ood" se desvanecen y D, F y G se juntan en "DFG".
// En pantallas chicas (max-md) se muestra siempre "DFG".
// Animaciones ligadas a la navegación (experimental, 2026-10-08): al hacer clic en el logo, si está
// dentro de un enlace, el ícono da un pequeño rebote; mientras llega la página siguiente, la
// cuadrícula se llena y sus cuadros se encienden en secuencia (navegacion-en-curso.ts). Las
// animaciones están en app/globals.css y se detienen con movimiento reducido.

import { useState } from "react";
import { useNavegacionEnCurso } from "./navegacion-en-curso";

// Trazos de cada parte de la palabra, en el viewBox original (597.56 × 75.1).
const TRAZOS = {
  "D": "M24.56 73.93H6.2V62.89H23.88Q31.74 62.89 36.91 59.91Q42.09 56.93 44.6 51.25Q47.12 45.56 47.12 37.45Q47.12 29.44 44.6 23.8Q42.09 18.16 37.04 15.19Q31.98 12.21 24.27 12.21H5.86V1.17H25.1Q35.94 1.17 43.8 5.57Q51.66 9.96 55.91 18.12Q60.16 26.27 60.16 37.45Q60.16 48.73 55.88 56.91Q51.61 65.09 43.68 69.51Q35.74 73.93 24.56 73.93Z M12.89 1.17V73.93H0V1.17Z",
  "ata": "M84.86 74.76Q79.74 74.76 75.71 73.05Q71.68 71.34 69.36 67.87Q67.04 64.4 67.04 59.28Q67.04 54.88 68.7 52.03Q70.36 49.17 73.19 47.46Q76.03 45.75 79.69 44.85Q83.35 43.95 87.3 43.55Q92.09 43.02 94.9 42.6Q97.71 42.19 98.93 41.38Q100.15 40.58 100.15 38.82V38.43Q100.15 36.18 99.02 34.5Q97.9 32.81 95.78 31.86Q93.65 30.91 90.72 30.91Q87.74 30.91 85.47 31.86Q83.2 32.81 81.88 34.5Q80.57 36.18 80.37 38.38H68.51Q68.85 33.25 71.61 29.42Q74.37 25.59 79.3 23.46Q84.23 21.34 90.97 21.34Q96 21.34 99.98 22.53Q103.96 23.73 106.71 26.03Q109.47 28.32 110.91 31.54Q112.35 34.77 112.35 38.77V73.93H100.24V66.65H100.05Q98.83 68.95 96.88 70.78Q94.92 72.61 91.99 73.68Q89.06 74.76 84.86 74.76Z M87.89 65.62Q91.94 65.62 94.68 64.16Q97.41 62.7 98.8 60.25Q100.2 57.81 100.2 54.83V49.27Q99.61 49.61 98.49 49.95Q97.36 50.29 95.83 50.61Q94.29 50.93 92.5 51.22Q90.72 51.51 88.82 51.81Q86.18 52.15 83.96 53Q81.74 53.86 80.4 55.35Q79.05 56.84 79.05 59.18Q79.05 61.18 80.15 62.65Q81.25 64.11 83.23 64.87Q85.21 65.62 87.89 65.62Z M150.44 22.36V32.28H118.6V22.36Z M127.59 8.3H139.94V59.13Q139.94 61.87 141.06 62.94Q142.19 64.01 145.17 64.01Q146.39 64.01 147.95 64.01Q149.51 64.01 150.44 64.01V73.93Q149.17 73.93 147.09 73.93Q145.02 73.93 143.02 73.93Q135.11 73.93 131.35 70.73Q127.59 67.53 127.59 60.94Z M175.05 74.76Q169.92 74.76 165.89 73.05Q161.87 71.34 159.55 67.87Q157.23 64.4 157.23 59.28Q157.23 54.88 158.89 52.03Q160.55 49.17 163.38 47.46Q166.21 45.75 169.87 44.85Q173.54 43.95 177.49 43.55Q182.28 43.02 185.08 42.6Q187.89 42.19 189.11 41.38Q190.33 40.58 190.33 38.82V38.43Q190.33 36.18 189.21 34.5Q188.09 32.81 185.96 31.86Q183.84 30.91 180.91 30.91Q177.93 30.91 175.66 31.86Q173.39 32.81 172.07 34.5Q170.75 36.18 170.56 38.38H158.69Q159.03 33.25 161.79 29.42Q164.55 25.59 169.48 23.46Q174.41 21.34 181.15 21.34Q186.18 21.34 190.16 22.53Q194.14 23.73 196.9 26.03Q199.66 28.32 201.1 31.54Q202.54 34.77 202.54 38.77V73.93H190.43V66.65H190.23Q189.01 68.95 187.06 70.78Q185.11 72.61 182.18 73.68Q179.25 74.76 175.05 74.76Z M178.08 65.62Q182.13 65.62 184.86 64.16Q187.6 62.7 188.99 60.25Q190.38 57.81 190.38 54.83V49.27Q189.79 49.61 188.67 49.95Q187.55 50.29 186.01 50.61Q184.47 50.93 182.69 51.22Q180.91 51.51 179 51.81Q176.37 52.15 174.15 53Q171.92 53.86 170.58 55.35Q169.24 56.84 169.24 59.18Q169.24 61.18 170.34 62.65Q171.44 64.11 173.41 64.87Q175.39 65.62 178.08 65.62Z",
  "F": "M214.01 73.93V1.17H262.94V12.35H226.9V32.23H260.35V43.16H226.9V73.93Z",
  "or": "M292.92 75.1Q285.35 75.1 279.61 71.7Q273.88 68.31 270.68 62.26Q267.48 56.2 267.48 48.19Q267.48 40.19 270.68 34.11Q273.88 28.03 279.61 24.61Q285.35 21.19 292.92 21.19Q300.54 21.19 306.25 24.61Q311.96 28.03 315.16 34.11Q318.36 40.19 318.36 48.19Q318.36 56.2 315.16 62.26Q311.96 68.31 306.25 71.7Q300.54 75.1 292.92 75.1Z M292.92 64.79Q296.88 64.79 299.78 62.79Q302.69 60.79 304.27 57.06Q305.86 53.32 305.86 48.19Q305.86 43.02 304.27 39.28Q302.69 35.55 299.78 33.52Q296.88 31.49 292.92 31.49Q288.96 31.49 286.04 33.52Q283.11 35.55 281.52 39.28Q279.93 43.02 279.93 48.19Q279.93 53.37 281.52 57.08Q283.11 60.79 286.04 62.79Q288.96 64.79 292.92 64.79Z M326.86 73.93V22.36H338.72V30.91H338.87Q340.28 26.46 343.33 24.17Q346.39 21.88 351.37 21.88Q352.64 21.88 353.64 21.92Q354.64 21.97 355.37 22.07V33.01Q354.74 32.91 353.08 32.76Q351.42 32.62 349.56 32.62Q346.68 32.62 344.31 33.96Q341.94 35.3 340.55 37.99Q339.16 40.67 339.16 44.73V73.93Z",
  "G": "M394.63 75.1Q384.57 75.1 376.88 70.36Q369.19 65.62 364.84 57.18Q360.5 48.73 360.5 37.6Q360.5 26.17 364.92 17.72Q369.34 9.28 377.05 4.64Q384.77 0 394.48 0Q400.63 0 405.98 1.83Q411.33 3.66 415.53 7.03Q419.73 10.4 422.44 15.01Q425.15 19.63 425.93 25.29H412.79Q412.11 22.17 410.55 19.65Q408.98 17.14 406.64 15.33Q404.3 13.53 401.32 12.55Q398.34 11.57 394.82 11.57Q388.28 11.57 383.5 14.79Q378.71 18.02 376.1 23.85Q373.49 29.69 373.49 37.6Q373.49 45.46 376.12 51.27Q378.76 57.08 383.57 60.3Q388.38 63.53 394.92 63.53Q400.34 63.53 404.57 61.3Q408.79 59.08 411.25 55.15Q413.72 51.22 413.72 46L417.04 46.24H396.78V36.04H426.42V44.82Q426.42 53.66 422.29 60.5Q418.16 67.33 411.01 71.22Q403.86 75.1 394.63 75.1Z",
  "ood": "M458.89 75.1Q451.32 75.1 445.58 71.7Q439.84 68.31 436.65 62.26Q433.45 56.2 433.45 48.19Q433.45 40.19 436.65 34.11Q439.84 28.03 445.58 24.61Q451.32 21.19 458.89 21.19Q466.5 21.19 472.22 24.61Q477.93 28.03 481.13 34.11Q484.33 40.19 484.33 48.19Q484.33 56.2 481.13 62.26Q477.93 68.31 472.22 71.7Q466.5 75.1 458.89 75.1Z M458.89 64.79Q462.84 64.79 465.75 62.79Q468.65 60.79 470.24 57.06Q471.83 53.32 471.83 48.19Q471.83 43.02 470.24 39.28Q468.65 35.55 465.75 33.52Q462.84 31.49 458.89 31.49Q454.93 31.49 452 33.52Q449.07 35.55 447.49 39.28Q445.9 43.02 445.9 48.19Q445.9 53.37 447.49 57.08Q449.07 60.79 452 62.79Q454.93 64.79 458.89 64.79Z M515.87 75.1Q508.3 75.1 502.56 71.7Q496.83 68.31 493.63 62.26Q490.43 56.2 490.43 48.19Q490.43 40.19 493.63 34.11Q496.83 28.03 502.56 24.61Q508.3 21.19 515.87 21.19Q523.49 21.19 529.2 24.61Q534.91 28.03 538.11 34.11Q541.31 40.19 541.31 48.19Q541.31 56.2 538.11 62.26Q534.91 68.31 529.2 71.7Q523.49 75.1 515.87 75.1Z M515.87 64.79Q519.82 64.79 522.73 62.79Q525.63 60.79 527.22 57.06Q528.81 53.32 528.81 48.19Q528.81 43.02 527.22 39.28Q525.63 35.55 522.73 33.52Q519.82 31.49 515.87 31.49Q511.91 31.49 508.98 33.52Q506.05 35.55 504.47 39.28Q502.88 43.02 502.88 48.19Q502.88 53.37 504.47 57.08Q506.05 60.79 508.98 62.79Q511.91 64.79 515.87 64.79Z M569.73 74.95Q563.04 74.95 557.98 71.58Q552.93 68.21 550.17 62.16Q547.41 56.1 547.41 48.1Q547.41 40.19 550.2 34.13Q552.98 28.08 558.01 24.71Q563.04 21.34 569.63 21.34Q573 21.34 575.9 22.24Q578.81 23.14 581.15 25Q583.5 26.86 585.16 29.69H585.25V1.17H597.56V73.93H585.45V66.06H585.35Q583.74 69.04 581.37 71.02Q579 73 576.05 73.97Q573.1 74.95 569.73 74.95Z M572.61 64.65Q576.66 64.65 579.64 62.62Q582.62 60.6 584.28 56.86Q585.94 53.12 585.94 48.1Q585.94 43.07 584.28 39.36Q582.62 35.64 579.64 33.59Q576.66 31.54 572.61 31.54Q568.85 31.54 565.97 33.47Q563.09 35.4 561.47 39.09Q559.86 42.77 559.86 48.1Q559.86 53.42 561.47 57.13Q563.09 60.84 565.97 62.74Q568.85 64.65 572.61 64.65Z"
};

// Ancho de la palabra completa y de "DFG" (D, F y G juntas con la misma separación de 7
// unidades que hay entre las letras), en unidades del viewBox.
const ALTO_VB = 75.1;
const ANCHO_COMPLETO = 597.56;
const ANCHO_ACRONIMO = 189;

// Transición común; se apaga si la persona pidió reducir el movimiento.
const TRANSICION = "duration-500 ease-out motion-reduce:transition-none";
// Partes que desaparecen ("ata", "or", "ood").
const SOBRA = `transition-opacity ${TRANSICION} group-hover/logo:opacity-0`;
const SOBRA_MOVIL = "max-md:opacity-0";
// F y G se recorren hasta quedar junto a la letra anterior (unidades del viewBox).
const MUEVE_F = `transition-transform ${TRANSICION} group-hover/logo:[transform:translateX(-146.8px)]`;
const MUEVE_F_MOVIL = "max-md:[transform:translateX(-146.8px)]";
const MUEVE_G = `transition-transform ${TRANSICION} group-hover/logo:[transform:translateX(-237.4px)]`;
const MUEVE_G_MOVIL = "max-md:[transform:translateX(-237.4px)]";
// Cuadros claros del ícono que se llenan de azul con el cursor. El retraso de cada uno solo
// aplica al entrar: al salir se vacían los tres juntos.
const POR_LLENAR = "fill-brand-600/30 transition-[fill] duration-300 ease-out motion-reduce:transition-none group-hover/logo:fill-brand-600";

// Cuadros del ícono: [x, y, claro]. El orden es el de encendido mientras se navega (fila de
// abajo, de en medio y de arriba), igual que ui/IndicadorDeCarga.
const CUADROS: [number, number, boolean][] = [
  [0, 42, false], [21, 42, false], [42, 42, false],
  [0, 21, false], [21, 21, false], [42, 21, true],
  [0, 0, false], [21, 0, true], [42, 0, true],
];
// Retraso al llenarse con el cursor, por cuadro claro, siguiendo la escalera.
const RETRASO_AL_LLENAR: Record<string, string> = {
  "42,21": "delay-0",
  "21,0": "group-hover/logo:delay-150",
  "42,0": "group-hover/logo:delay-300",
};

export function IconoDelLogo({
  tamano = 24,
  className = "",
  cargando = false,
  onAnimationEnd,
}: {
  tamano?: number;
  className?: string;
  /** Mientras llega la página siguiente: cuadrícula llena y cuadros encendiéndose en secuencia. */
  cargando?: boolean;
  onAnimationEnd?: React.AnimationEventHandler<SVGSVGElement>;
}) {
  return (
    <svg
      viewBox="0 0 57 57"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      className={`shrink-0 ${cargando ? "indicador-de-carga" : ""} ${className}`}
      onAnimationEnd={onAnimationEnd}
    >
      {CUADROS.map(([x, y, claro], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="15"
          height="15"
          rx="3.5"
          style={{ "--i": i } as React.CSSProperties}
          className={
            !claro
              ? "fill-brand-600"
              : // Azul claro del logo original (#C5D1E8): el azul del tema al 30 %. Con el cursor se
                // llenan uno por uno (los aportes completan el conjunto de datos); cargando, llenos.
                cargando
                ? "fill-brand-600"
                : `${POR_LLENAR} ${RETRASO_AL_LLENAR[`${x},${y}`]}`
          }
        />
      ))}
    </svg>
  );
}

export default function Logo({
  alto = 16,
  tamanoIcono,
  acronimoEnMovil = true,
  className = "",
}: {
  /** Alto de la palabra en px; el ícono mide 1.5 veces esto si no se indica otro tamaño. */
  alto?: number;
  tamanoIcono?: number;
  /** En pantallas chicas muestra siempre "DFG". */
  acronimoEnMovil?: boolean;
  className?: string;
}) {
  const escala = alto / ALTO_VB;
  const anchoCompleto = ANCHO_COMPLETO * escala;
  const anchoAcronimo = ANCHO_ACRONIMO * escala;
  const movil = (clase: string) => (acronimoEnMovil ? clase : "");
  const cargando = useNavegacionEnCurso();
  const [rebote, setRebote] = useState(false);

  return (
    <span
      className={`group/logo inline-flex items-center gap-2 ${className}`}
      // Solo rebota si el logo es un enlace (en la 404 y otras pantallas no lo es).
      onClick={(evento) => {
        if (evento.currentTarget.closest("a")) setRebote(true);
      }}
    >
      <IconoDelLogo
        tamano={tamanoIcono ?? Math.round(alto * 1.5)}
        cargando={cargando}
        className={rebote ? "logo-rebote" : ""}
        onAnimationEnd={(evento) => {
          if (evento.target === evento.currentTarget) setRebote(false);
        }}
      />
      <span className="sr-only">DataForGood</span>
      {/* La caja conserva el ancho de la palabra al pasar el cursor (así no se recorre lo que
          está al lado ni se pierde el hover); en pantallas chicas mide solo lo que ocupa "DFG". */}
      <span
        aria-hidden="true"
        style={
          {
            "--logo-ancho": `${anchoCompleto}px`,
            "--logo-ancho-acronimo": `${anchoAcronimo}px`,
            height: alto,
          } as React.CSSProperties
        }
        className={`block w-(--logo-ancho) overflow-hidden ${movil("max-md:w-(--logo-ancho-acronimo)")}`}
      >
        <svg viewBox={`0 0 ${ANCHO_COMPLETO} ${ALTO_VB}`} width={anchoCompleto} height={alto} className="block max-w-none">
          <path className="fill-system-900" d={TRAZOS.D} />
          <path className={`fill-system-900 ${SOBRA} ${movil(SOBRA_MOVIL)}`} d={TRAZOS.ata} />
          <path className={`fill-brand-600 ${MUEVE_F} ${movil(MUEVE_F_MOVIL)}`} d={TRAZOS.F} />
          <path className={`fill-brand-600 ${SOBRA} ${movil(SOBRA_MOVIL)}`} d={TRAZOS.or} />
          <path className={`fill-system-900 ${MUEVE_G} ${movil(MUEVE_G_MOVIL)}`} d={TRAZOS.G} />
          <path className={`fill-system-900 ${SOBRA} ${movil(SOBRA_MOVIL)}`} d={TRAZOS.ood} />
        </svg>
      </span>
    </span>
  );
}
