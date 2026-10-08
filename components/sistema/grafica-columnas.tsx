// Gráfica de columnas sencilla (SVG/CSS) para los dashboards del panel.

export type Columna = { etiqueta: string; valor: number };

/**
 * Gráfica de columnas en SVG, sin dependencias. Escala al ancho disponible y
 * las alturas salen del dato, no de coordenadas fijas.
 *
 * Se anuncia como imagen con su descripción, y además deja una tabla oculta
 * para lectores de pantalla: la forma general la da el aria-label, los valores
 * exactos la tabla.
 */
export default function GraficaDeColumnas({
  columnas,
  descripcion,
  alto = 128,
}: {
  columnas: Columna[];
  descripcion: string;
  alto?: number;
}) {
  const ANCHO = 640;
  const BASE = alto - 9; // deja sitio para las etiquetas del eje
  const ALTO_MAX = BASE - 5;
  const hueco = 12;
  const paso = ANCHO / columnas.length;
  const anchoBarra = paso - hueco;
  const tope = Math.max(...columnas.map((c) => c.valor), 1);

  return (
    <>
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        style={{ width: "100%", height: "auto" }}
        role="img"
        aria-label={descripcion}
      >
        <g className="fill-brand-600">
          {columnas.map((c, i) => {
            const h = Math.max(2, Math.round((c.valor / tope) * ALTO_MAX));
            return (
              <rect
                key={c.etiqueta}
                x={i * paso + hueco / 2}
                y={BASE - h}
                width={anchoBarra}
                height={h}
                rx={3}
              />
            );
          })}
        </g>
        <line
          className="stroke-system-300"
          x1="0"
          y1={BASE + 1}
          x2={ANCHO}
          y2={BASE + 1}
          strokeWidth={1}
        />
        <g className="fill-system-500 font-mono" fontSize={9}>
          {columnas.map((c, i) => (
            <text key={c.etiqueta} x={i * paso + paso / 2} y={alto} textAnchor="middle">
              {c.etiqueta}
            </text>
          ))}
        </g>
      </svg>

      <table className="sr-only">
        <caption>{descripcion}</caption>
        <tbody>
          {columnas.map((c) => (
            <tr key={c.etiqueta}>
              <th scope="row">{c.etiqueta}</th>
              <td>{c.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
