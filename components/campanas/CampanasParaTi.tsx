// "Campañas para ti": hasta 3 campañas activas para la persona (de sus intereses, de su estado o las
// más concurridas), con por qué se le recomiendan. Sin estado ni efectos: lo usan /inicio (Server
// Component) y /campanas ("Explorar campañas" del menú, componente cliente; 2026-10-27). Los datos salen de
// campanasParaTi() de lib/usuarios/inicio.ts (en /campanas, vía GET /api/campanas?paraTi=true).

import Link from "next/link";
import type { ReactNode } from "react";

import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import type { CampanaParaTi } from "@/lib/usuarios/inicio";

const nf = new Intl.NumberFormat("es-MX");

const MOTIVO: Record<CampanaParaTi["motivo"], string> = {
  interes: "De tus intereses",
  estado: "En tu estado",
  popular: "Popular",
};

export default function CampanasParaTi({
  id,
  campanas,
  accion,
  vacio,
  className = "",
}: {
  /** id del título (aria-labelledby): cada pantalla usa el suyo. */
  id: string;
  campanas: CampanaParaTi[];
  /** Enlace a la derecha del título (en /inicio, "Ver todas →"). */
  accion?: ReactNode;
  /** Qué mostrar sin campañas; sin él, no se dibuja la sección. */
  vacio?: ReactNode;
  className?: string;
}) {
  if (campanas.length === 0 && !vacio) return null;
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id={id} className="text-lg font-extrabold text-system-900">
          Campañas para ti
        </h2>
        {accion}
      </div>
      {campanas.length === 0 ? (
        vacio
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campanas.map((c) => {
            const pct = porcentajeDeMeta(c.aprobados, c.meta);
            return (
              <Link key={c.id} href={`/campanas/${c.id}`} className="block rounded-lg">
                <Card className="flex h-full min-w-0 flex-col hover:border-brand-600">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {c.tematica && <Tag>{c.tematica}</Tag>}
                    <Tag tone={c.motivo === "popular" ? "default" : "ok"}>{MOTIVO[c.motivo]}</Tag>
                  </div>
                  <p className="line-clamp-2 break-words text-[15px] font-bold text-system-900" title={c.nombre}>
                    {c.nombre}
                  </p>
                  <div className="mt-auto pt-3">
                    <ProgressBar pct={pct} tone="ok" />
                    <p className="mt-2 font-mono text-[11px] text-system-500">
                      {nf.format(c.participantes)} {c.participantes === 1 ? "participante" : "participantes"} · {pct}% de la meta
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
