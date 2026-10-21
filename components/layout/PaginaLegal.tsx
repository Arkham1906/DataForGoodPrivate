// Página de un texto legal (/terminos y /privacidad): encabezado público, título, fecha de
// actualización, índice de secciones y pie. Pendiente muestra un dato que el equipo no ha definido
// (lib/legal.ts) para que se vea a simple vista que falta.

import type { ReactNode } from "react";
import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { FECHA_DE_ACTUALIZACION } from "@/lib/legal";

export type SeccionLegal = { id: string; titulo: string; contenido: ReactNode };

export default function PaginaLegal({
  titulo,
  introduccion,
  secciones,
  otroTexto,
}: {
  titulo: string;
  introduccion: ReactNode;
  secciones: SeccionLegal[];
  /** Enlace al otro texto legal, al final. */
  otroTexto: { href: string; etiqueta: string };
}) {
  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-[28px] font-extrabold tracking-tight text-system-900">{titulo}</h1>
        <p className="mt-2 font-mono text-[11.5px] text-system-500">Última actualización: {FECHA_DE_ACTUALIZACION}</p>
        <div className="mt-5 space-y-3 text-[14.5px] leading-relaxed text-system-600">{introduccion}</div>

        <nav aria-label="Contenido" className="mt-8 rounded-lg border border-system-200 bg-white p-4">
          <p className="mb-2 text-[12.5px] font-semibold text-system-900">Contenido</p>
          <ol className="list-decimal space-y-1 pl-5 text-[13px]">
            {secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand-600 hover:underline">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {secciones.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="mt-10 scroll-mt-6">
            <h2 id={`${s.id}-titulo`} className="text-lg font-extrabold text-system-900">
              {i + 1}. {s.titulo}
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-system-600 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
              {s.contenido}
            </div>
          </section>
        ))}

        <p className="mt-12 border-t border-system-200 pt-6 text-[13px] text-system-600">
          Consulta también {" "}
          <Link href={otroTexto.href} className="font-semibold text-brand-600 hover:underline">
            {otroTexto.etiqueta}
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

/** Un dato de lib/legal.ts: su valor o, si falta, "[Pendiente: ...]" resaltado. */
export function Pendiente({ valor, falta }: { valor: string | null; falta: string }) {
  if (valor) return <>{valor}</>;
  return <mark className="rounded bg-warning-50 px-1 font-semibold text-warning-700">[Pendiente: {falta}]</mark>;
}
