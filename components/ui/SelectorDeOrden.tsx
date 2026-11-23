"use client";

export default function SelectorDeOrden({ valor, onCambiar, opciones }: {
  valor: string;
  onCambiar: (valor: string) => void;
  opciones: { value: string; label: string }[];
}) {
  return (<label className="relative flex min-h-[38px] min-w-0 flex-1 items-center gap-2 rounded-pill border border-system-300 bg-white px-3 py-1 text-system-900 transition-colors hover:border-brand-600 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4 shrink-0 text-system-600"><path d="M8 4v16m-4-4 4 4 4-4M16 20V4m-4 4 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span aria-hidden="true" className="min-w-0 flex-1 leading-tight">
              <span className="block text-[10px] font-medium text-system-500">Ordenar por</span>
              <span className="block truncate text-xs font-semibold">{opciones.find((opcion) => opcion.value === valor)?.label ?? ""}</span>
            </span>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="size-3 shrink-0"><path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <select aria-label="Ordenar por" value={valor} onChange={(e) => onCambiar(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
              {opciones.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
            </select>
          </label>);
}
