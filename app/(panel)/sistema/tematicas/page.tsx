// Pantalla /sistema/tematicas: catálogo de temáticas (2026-10-07). Las 23 base y las que salen de lo
// que escriben los usuarios sobre sus gustos (lib/tematicas/analizar.ts). El SuperUsuario oculta las
// que no deben ofrecerse (groserías que pasaron el filtro, palabras sin sentido) o las vuelve a mostrar.
// Server Component. Acceso: sesión raíz. Datos: lib/tematicas/catalogo.ts. Búsqueda con ?q=.
// Acción: cambiarVisibilidadDeTematica (lib/tematicas/acciones-tematicas.ts), en BotonDeVisibilidad.

import type { Metadata } from "next";

import Tag from "@/components/sistema/Tag";
import { Encabezado, formatearNumero } from "@/components/sistema/ui";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { listarTematicasDelPanel } from "@/lib/tematicas/catalogo";
import { ZONA_DE_CAMPANAS } from "@/lib/campaign-date";
import BotonDeVisibilidad from "./BotonDeVisibilidad";

export const metadata: Metadata = { title: "Temáticas" };
export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: ZONA_DE_CAMPANAS });

export default async function TematicasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirSesionRoot();
  const { q = "" } = await searchParams;
  const tematicas = await listarTematicasDelPanel(q);
  const deUsuarios = tematicas.filter((t) => t.origen === "usuario").length;
  const ocultas = tematicas.filter((t) => t.oculta).length;

  return (
    <div>
      <Encabezado
        titulo="Temáticas"
        subtitulo="Intereses de los perfiles y temáticas de las campañas. Las nuevas salen de lo que escriben los usuarios sobre sus gustos; una oculta deja de ofrecerse, pero no se quita de los perfiles ni de las campañas que ya la tienen."
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar temática"
          aria-label="Buscar temática"
          className="w-full max-w-xs rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
        />
        <p className="font-mono text-[12px] text-system-400">
          {formatearNumero(tematicas.length)} {q ? "encontradas" : "en total"} · {formatearNumero(deUsuarios)} de usuarios ·{" "}
          {formatearNumero(ocultas)} ocultas
        </p>
      </form>

      {tematicas.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ninguna temática coincide con «{q}».</p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
          {tematicas.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className={`break-words font-bold ${t.oculta ? "text-system-400 line-through" : "text-system-900"}`}>{t.nombre}</p>
                <p className="mt-0.5 text-[12px] text-system-400">
                  {t.origen === "base" ? "Base" : `De un usuario · ${fecha.format(new Date(t.creadaEl))}`} ·{" "}
                  {formatearNumero(t.personas)} {t.personas === 1 ? "persona" : "personas"} ·{" "}
                  {formatearNumero(t.campanas)} {t.campanas === 1 ? "campaña" : "campañas"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.oculta ? <Tag tone="warn">Oculta</Tag> : null}
                <BotonDeVisibilidad id={t.id} nombre={t.nombre} oculta={t.oculta} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
