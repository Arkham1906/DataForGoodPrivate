// Indicador de carga con la cuadrícula del logo (experimental, 2026-10-08): los 9 cuadros se
// encienden uno tras otro, fila por fila desde abajo, como datos que llegan. Toma el color del
// texto (currentColor), así que sirve dentro de un botón primario (blanco) o sobre fondo claro.
// La animación está en app/globals.css (.indicador-de-carga; el orden llega en --i) y se detiene
// con movimiento reducido. El ícono del logo usa la misma mientras se navega.
// Es decorativo: quien lo use debe decir con texto qué está pasando ("Enviando…").

// Orden de encendido: fila de abajo, de en medio y de arriba, de izquierda a derecha.
const CUADROS = [
  [0, 42], [21, 42], [42, 42],
  [0, 21], [21, 21], [42, 21],
  [0, 0], [21, 0], [42, 0],
];

export default function IndicadorDeCarga({ tamano = 16, className = "" }: { tamano?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 57 57"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      className={`indicador-de-carga shrink-0 fill-current ${className}`}
    >
      {CUADROS.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="15" height="15" rx="3.5" style={{ "--i": i } as React.CSSProperties} />
      ))}
    </svg>
  );
}
