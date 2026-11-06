// Ilustración de la portada (landing, 2026-11-06): curvas de nivel de un mapa con puntos de campo unidos
// entre sí, la idea de muchos datos locales que forman un conjunto. Dibujo propio, generado aquí con los
// colores del proyecto. Server Component decorativo: oculto para lectores de pantalla.

type Cerro = { x: number; y: number; ancho: number; alto: number; semilla: number; color: string };

const CERROS: Cerro[] = [
  { x: 170, y: 340, ancho: 420, alto: 230, semilla: 1.3, color: "var(--color-success-700)" },
  { x: 1430, y: 350, ancho: 460, alto: 240, semilla: 4.1, color: "var(--color-success-700)" },
  { x: 790, y: 390, ancho: 680, alto: 340, semilla: 2.6, color: "var(--color-brand-600)" },
];

const ANILLOS = 7;

const PUNTOS: [number, number][] = [
  [205, 214],
  [430, 262],
  [640, 150],
  [800, 92],
  [965, 176],
  [1160, 250],
  [1395, 196],
];

// Cada punto de campo se une al central y a su vecino.
const CENTRO = PUNTOS[3];

/** Curva cerrada irregular alrededor de (x, y): sin aleatorio, el dibujo sale igual en cada visita. */
function curva({ x, y, ancho, alto, semilla }: Cerro, escala: number): string {
  const lados = 72;
  const puntos: string[] = [];
  for (let i = 0; i < lados; i += 1) {
    const angulo = (i / lados) * Math.PI * 2;
    const ondulacion = 1 + 0.07 * Math.sin(3 * angulo + semilla) + 0.04 * Math.sin(7 * angulo + semilla * 2);
    const px = x + Math.cos(angulo) * ancho * escala * ondulacion;
    const py = y + Math.sin(angulo) * alto * escala * ondulacion;
    puntos.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return `M${puntos.join("L")}Z`;
}

export default function IlustracionDeCampo() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1600 300"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      {CERROS.map((cerro) =>
        Array.from({ length: ANILLOS }, (_, i) => (
          <path
            key={`${cerro.x}-${i}`}
            d={curva(cerro, 1 - i * 0.13)}
            fill={cerro.color}
            fillOpacity={0.12}
            stroke="var(--color-white)"
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
        )),
      )}

      <g stroke="var(--color-white)" strokeWidth={1.6} strokeOpacity={0.9} fill="none">
        {PUNTOS.filter((p) => p !== CENTRO).map(([x, y]) => (
          <line key={`c-${x}`} x1={x} y1={y} x2={CENTRO[0]} y2={CENTRO[1]} />
        ))}
        {PUNTOS.slice(1).map(([x, y], i) => (
          <line key={`v-${x}`} x1={PUNTOS[i][0]} y1={PUNTOS[i][1]} x2={x} y2={y} />
        ))}
      </g>

      {PUNTOS.map(([x, y]) => (
        <g key={`p-${x}`}>
          <circle cx={x} cy={y} r={p(x)} fill="var(--color-white)" fillOpacity={0.35} />
          <circle cx={x} cy={y} r={5} fill="var(--color-white)" />
        </g>
      ))}
    </svg>
  );
}

/** El punto central destaca sobre los demás. */
function p(x: number): number {
  return x === CENTRO[0] ? 18 : 11;
}
