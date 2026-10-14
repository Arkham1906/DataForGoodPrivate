// Podio de la tabla de líderes (2026-10-13): los 3 primeros lugares en escalones, con el 1.º al centro
// y más alto. En móvil se apilan en orden (1.º, 2.º, 3.º); el ajuste a 360 px lo revisa Gerard.
// Datos: los recibe de TablaDeLideres (lib/gamificacion/tipos.ts); no consulta nada.

import Avatar from "@/components/ui/Avatar";
import { textoDelValor, type CategoriaDeClasificacion, type Lider } from "@/lib/gamificacion/tipos";

/** Por lugar: orden visual en escritorio (2.º, 1.º, 3.º), alto del escalón y colores (oro, plata, bronce). */
const LUGAR = [
  { orden: "sm:order-2", escalon: "sm:h-28", color: "bg-warning-200 text-warning-900 border-warning-300", medalla: "1.º" },
  { orden: "sm:order-1", escalon: "sm:h-20", color: "bg-system-200 text-system-800 border-system-300", medalla: "2.º" },
  { orden: "sm:order-3", escalon: "sm:h-14", color: "bg-error-100 text-error-800 border-error-200", medalla: "3.º" },
];

export default function Podio({ lideres, categoria }: { lideres: Lider[]; categoria: CategoriaDeClasificacion }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-center sm:gap-4" aria-label="Podio">
      {lideres.slice(0, LUGAR.length).map((lider, i) => {
        const lugar = LUGAR[i];
        return (
          <li key={lider.usuarioId} className={`flex flex-col items-center sm:w-44 ${lugar.orden}`}>
            <div className="mb-2 flex flex-col items-center gap-1.5 text-center">
              <Avatar
                datos={{ usuarioId: lider.usuarioId, nombre: lider.nombre, avatar: lider.avatar, version: null }}
                tamano={i === 0 ? "lg" : "md"}
              />
              <p className="text-[14px] font-bold text-system-900">{lider.nombre}</p>
              <p className="text-[12.5px] font-semibold text-system-600">{textoDelValor(categoria, lider.valor)}</p>
              {lider.detalle && <p className="font-mono text-[11px] text-system-500">{lider.detalle}</p>}
            </div>
            <div
              className={`flex h-10 w-full items-center justify-center rounded-t-lg border border-b-0 text-[15px] font-extrabold ${lugar.escalon} ${lugar.color}`}
            >
              <span aria-label={`Lugar ${i + 1}`}>{lugar.medalla}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
