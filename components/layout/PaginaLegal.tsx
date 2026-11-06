// Página de un texto legal (/terminos y /privacidad): encabezado público, título, fecha de
// actualización, índice de secciones y pie. Pendiente muestra un dato que el equipo no ha definido
// (lib/legal.ts) para que se vea a simple vista que falta.
// Diseño del 2026-11-06: el de la landing, con el índice fijo a la izquierda en escritorio. Los títulos llevan
// scroll-mt para que el encabezado fijo no los tape al saltar desde el índice.

import type { ReactNode } from "react";
import Link from "next/link";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import { retraso } from "@/lib/animaciones";
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
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />
      <main id="contenido">
        <div className="mx-auto max-w-[1180px] px-6 pt-14 md:pt-20">
          <EncabezadoPublico centrado etiqueta="Legal" titulo={titulo}>
            <p className="font-mono text-[12px] text-system-500">Última actualización: {FECHA_DE_ACTUALIZACION}</p>
            {introduccion}
          </EncabezadoPublico>
        </div>

        <FranjaDeCampo style={retraso(240)} className="landing-entrada mt-10 h-[110px]" />

        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 px-6 pb-24 pt-10 md:grid-cols-[260px_1fr] md:gap-14">
          <nav
            aria-label="Contenido"
            style={retraso(320)}
            className="landing-entrada self-start rounded-[18px] border border-system-200 bg-white p-4 md:sticky md:top-[84px] md:max-h-[calc(100vh-104px)] md:overflow-y-auto"
          >
            <p className="mb-2.5 font-mono text-[12.5px] text-system-600">Contenido</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">
              {secciones.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-brand-600 hover:underline">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 max-w-2xl">
            {secciones.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="landing-revelar mb-10 scroll-mt-24">
                <h2 id={`${s.id}-titulo`} className="text-[22px] font-semibold leading-tight tracking-tight text-system-900">
                  {i + 1}. {s.titulo}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-system-600 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
                  {s.contenido}
                </div>
              </section>
            ))}

            <p className="border-t border-system-200 pt-6 text-[13.5px] text-system-600">
              Consulta también{" "}
              <Link href={otroTexto.href} className="font-semibold text-brand-600 hover:underline">
                {otroTexto.etiqueta}
              </Link>
              .
            </p>
          </div>
        </div>
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
