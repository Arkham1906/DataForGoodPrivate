// Lista de la tabla de líderes (2026-10-13): del 4.º lugar en adelante, un renglón por persona con su
// valor a la derecha. Datos: los recibe de TablaDeLideres (lib/gamificacion/tipos.ts); no consulta nada.

import Avatar from "@/components/ui/Avatar";
import { textoDelValor, type CategoriaDeClasificacion, type Lider } from "@/lib/gamificacion/tipos";

export default function ListaDeLideres({
  lideres,
  categoria,
  desde,
}: {
  lideres: Lider[];
  categoria: CategoriaDeClasificacion;
  /** Lugar del primer renglón (4 si el podio muestra 3). */
  desde: number;
}) {
  if (lideres.length === 0) return null;
  return (
    <ol start={desde} className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
      {lideres.map((lider, i) => (
        <li key={lider.usuarioId} className="flex items-center gap-3 px-4 py-3">
          <span className="w-6 shrink-0 text-center font-mono text-[13px] font-bold text-system-500">{desde + i}</span>
          <Avatar datos={{ usuarioId: lider.usuarioId, nombre: lider.nombre, avatar: lider.avatar, version: null }} />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-system-900">{lider.nombre}</span>
          <span className="shrink-0 text-right">
            <span className="block text-[13px] font-semibold text-system-700">{textoDelValor(categoria, lider.valor)}</span>
            {lider.detalle && <span className="block font-mono text-[11px] text-system-500">{lider.detalle}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
