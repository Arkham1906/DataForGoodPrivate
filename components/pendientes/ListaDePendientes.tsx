// Lista de pendientes por sección (2026-11-24, a pedido del usuario). La usan /pendientes (zona de usuario) y
// /sistema/pendientes (panel). Arriba, cuántos hay y cuántos son urgentes; luego una tarjeta por sección con un renglón
// por pendiente: qué hacer (enlace), cuánto lleva esperando o cuándo vence, y la etiqueta Urgente/Pronto. Dentro de cada
// sección van de lo más urgente a lo menos (ya llegan ordenados). Sin pendientes, "Todo al día".
// Sin estado ni imports de servidor: se pinta en el servidor.

import Link from "next/link";
import {
  ETIQUETA_DE_URGENCIA,
  plural,
  type Pendiente,
  type Seccion,
  type Urgencia,
} from "@/lib/pendientes/tipos";

const CLASE_DE_URGENCIA: Record<Urgencia, string> = {
  urgente: "border-error-700 bg-error-700 text-white",
  pronto: "border-warning-300 bg-warning-50 text-warning-800",
  normal: "",
};

/** Franja a la izquierda del renglón: dice la urgencia sin depender solo del color de la etiqueta. */
const CLASE_DE_FRANJA: Record<Urgencia, string> = {
  urgente: "border-l-error-700",
  pronto: "border-l-warning-500",
  normal: "border-l-system-200",
};

function Renglon({ p }: { p: Pendiente }) {
  return (
    <li>
      <Link
        href={p.href}
        className={`group flex items-start justify-between gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-system-50 focus-visible:bg-system-50 ${CLASE_DE_FRANJA[p.urgencia]}`}
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-system-900 group-hover:text-brand-700 group-hover:underline">
            {p.texto}
          </span>
          {p.detalle ? <span className="mt-0.5 block text-[12.5px] text-system-600">{p.detalle}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {p.urgencia !== "normal" ? (
            <span className={`rounded-pill border px-2 py-0.5 text-[11px] font-bold ${CLASE_DE_URGENCIA[p.urgencia]}`}>
              {ETIQUETA_DE_URGENCIA[p.urgencia]}
            </span>
          ) : null}
          <span aria-hidden="true" className="text-system-500 group-hover:text-brand-700">
            →
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function ListaDePendientes({
  pendientes,
  secciones,
  sugerencia,
  sinPendientes,
}: {
  pendientes: Pendiente[];
  secciones: Seccion[];
  /** Algo que no es pendiente pero conviene ver (zona de usuario): va al final, aparte. */
  sugerencia?: Pendiente | null;
  /** Texto de "Todo al día". */
  sinPendientes: string;
}) {
  const urgentes = pendientes.filter((p) => p.urgencia === "urgente").length;
  const pronto = pendientes.filter((p) => p.urgencia === "pronto").length;
  const conPendientes = secciones
    .map((s) => ({ ...s, lista: pendientes.filter((p) => p.seccion === s.clave) }))
    .filter((s) => s.lista.length > 0);

  return (
    <div className="space-y-6">
      {pendientes.length === 0 ? (
        <div className="rounded-[18px] border border-success-200 bg-success-50 p-6 text-center">
          <p className="text-[15px] font-bold text-success-800">Todo al día</p>
          <p className="mt-1 text-[13.5px] text-system-700">{sinPendientes}</p>
        </div>
      ) : (
        <p className="text-[13.5px] text-system-700" aria-live="polite">
          <strong className="text-system-900">{plural(pendientes.length, "pendiente", "pendientes")}</strong>
          {urgentes > 0 ? (
            <>
              {" · "}
              <span className="font-semibold text-error-700">{plural(urgentes, "urgente", "urgentes")}</span>
            </>
          ) : null}
          {pronto > 0 ? ` · ${pronto} para atender pronto` : ""}
          . Lo más urgente va primero en cada sección.
        </p>
      )}

      {conPendientes.map((s) => (
        <section key={s.clave} aria-labelledby={`pendientes-${s.clave}`} className="overflow-hidden rounded-[18px] border border-system-200 bg-white">
          <header className="border-b border-system-200 px-4 py-3">
            <h2 id={`pendientes-${s.clave}`} className="flex items-center gap-2 text-[15px] font-bold text-system-900">
              {s.titulo}
              <span className="rounded-pill bg-system-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-system-700">
                {s.lista.length}
              </span>
            </h2>
            <p className="mt-0.5 text-[12.5px] text-system-600">{s.descripcion}</p>
          </header>
          <ul className="divide-y divide-system-200">
            {s.lista.map((p) => (
              <Renglon key={p.clave} p={p} />
            ))}
          </ul>
        </section>
      ))}

      {sugerencia ? (
        <section aria-labelledby="pendientes-sugerencia" className="overflow-hidden rounded-[18px] border border-dashed border-system-300 bg-white">
          <header className="px-4 pt-3">
            <h2 id="pendientes-sugerencia" className="text-[15px] font-bold text-system-900">
              Te puede interesar
            </h2>
            <p className="mt-0.5 text-[12.5px] text-system-600">No es un pendiente: una campaña que cierra pronto y necesita aportes.</p>
          </header>
          <ul>
            <Renglon p={sugerencia} />
          </ul>
        </section>
      ) : null}
    </div>
  );
}
