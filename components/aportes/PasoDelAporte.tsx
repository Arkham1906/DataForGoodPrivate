import { IconoListo } from "@/components/aportes/IconosDelAporte";

/** Tarjeta numerada de un paso del formulario; el número cambia a una palomita verde cuando queda listo. */
export default function Paso({ numero, titulo, nota, listo, children }: { numero: number; titulo: string; nota?: string; listo: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border bg-white p-4 shadow-sm transition-colors sm:p-5 ${listo ? "border-success-300" : "border-system-200"}`}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${listo ? "bg-success-700 text-white" : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"}`}
        >
          {listo ? <IconoListo className="size-4" strokeWidth={2.5} /> : numero}
        </span>
        <h2 className="min-w-0 flex-1 text-[15px] font-bold text-system-900">
          <span className="sr-only">Paso {numero}: </span>
          {titulo}
        </h2>
        {nota && <span className="shrink-0 rounded-pill bg-system-100 px-2 py-0.5 text-[11px] font-medium text-system-600">{nota}</span>}
      </div>
      <div className="[&>*:last-child]:mb-0">{children}</div>
    </section>
  );
}
