// Las campañas a las que se parece una campaña rechazada por "Ya existe una campaña similar" (2026-11-11,
// a pedido del usuario), dentro del recuadro del rechazo que ve su creador: /mis-campanas/[id] y el
// formulario al corregirla. Las elige la supervisión al rechazar (lib/supervision/decision.ts); llegan en
// `rechazo.similares` de GET /api/campanas?mine=true. Las que el creador puede abrir (activa, pausada,
// finalizada) llevan a /campanas/[id]; una programada todavía no se puede ver y va sin enlace.

import Link from "next/link";

import type { CampanaParecidaDelRechazo } from "@/lib/campanas/rechazo";

export default function CampanasParecidasDelRechazo({ similares }: { similares: CampanaParecidaDelRechazo[] }) {
  if (similares.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="font-semibold text-system-900">
        {similares.length === 1 ? "Campaña a la que se parece:" : "Campañas a las que se parece:"}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-system-600">
        {similares.map((c) => (
          <li key={c.id} className="break-words">
            {c.abrible ? (
              <Link href={`/campanas/${c.id}`} className="font-semibold text-brand-700 underline hover:text-brand-800">
                {c.nombre}
              </Link>
            ) : (
              <>
                <span className="font-semibold text-system-900">{c.nombre}</span>{" "}
                <span className="text-system-500">(programada, todavía no se puede ver)</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
