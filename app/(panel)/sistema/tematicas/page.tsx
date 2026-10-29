// Pantalla /sistema/tematicas: catálogo de temáticas (2026-10-07). Las base y las que salen de lo
// que escriben los usuarios sobre sus gustos (lib/tematicas/analizar.ts). El SuperUsuario oculta las
// que no deben ofrecerse (groserías que pasaron el filtro, palabras sin sentido) o las vuelve a mostrar.
// Desde el 2026-10-19 las nuevas de usuarios entran pendientes (arriba de todo): Aprobar o Rechazar
// en BotonesDeRevision (revisarTematica); desde el 2026-10-22 rechazar la borra del catálogo
// (antes quedaba "Rechazada" con "Aprobar"). El menú lleva el número de pendientes. Desde el
// 2026-10-20 el texto ya no crea temáticas: solo quedan por revisar las que se crearon antes.
// Server Component. Acceso: sesión raíz. Datos: lib/tematicas/catalogo.ts. Búsqueda con ?q=.
// Acción: cambiarVisibilidadDeTematica (lib/tematicas/acciones-tematicas.ts), en BotonDeVisibilidad.
// Desde el 2026-10-26 el SuperUsuario crea temáticas (NuevaTematica, origen "panel") y edita o borra
// las que no son base desde "Más" (EditarOBorrar): renombrar las cambia en perfiles y campañas; no se
// borra una que usan campañas. Las base solo se ocultan.
// Desde el 2026-10-27 cada temática despliega sus etiquetas (subtemáticas; EtiquetasDeTematica): el
// SuperUsuario las crea, edita, borra, oculta, y aprueba o rechaza las que propusieron los creadores.

import type { Metadata } from "next";

import Tag from "@/components/sistema/Tag";
import { Encabezado, formatearNumero } from "@/components/sistema/ui";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { listarTematicasDelPanel } from "@/lib/tematicas/catalogo";
import { listarEtiquetasDelPanel } from "@/lib/etiquetas/catalogo";
import EtiquetasDeTematica from "./EtiquetasDeTematica";
import { ZONA_DE_CAMPANAS } from "@/lib/campaign-date";
import BotonDeVisibilidad from "./BotonDeVisibilidad";
import BotonesDeRevision from "./BotonesDeRevision";
import EditarOBorrar from "./EditarOBorrar";
import NuevaTematica from "./NuevaTematica";

export const metadata: Metadata = { title: "Temáticas" };
export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: ZONA_DE_CAMPANAS });

export default async function TematicasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirSesionRoot();
  const { q = "" } = await searchParams;
  const [tematicas, etiquetas] = await Promise.all([listarTematicasDelPanel(q), listarEtiquetasDelPanel()]);
  const etiquetasPorRevisar = [...etiquetas.values()].flat().filter((e) => !e.aprobada).length;
  const deUsuarios = tematicas.filter((t) => t.origen === "usuario").length;
  const delPanel = tematicas.filter((t) => t.origen === "panel").length;
  const ocultas = tematicas.filter((t) => t.oculta).length;
  const pendientes = tematicas.filter((t) => !t.aprobada && !t.oculta).length;

  return (
    <div>
      <Encabezado
        titulo="Temáticas"
        subtitulo="Intereses de los perfiles y temáticas de las campañas. Cada temática tiene sus etiquetas (subtemáticas, como Perros o Gatos en Protección animal): las creas aquí o las proponen los usuarios (al hacer su campaña o en sus intereses), y quedan por revisar; si rechazas una, se borra y se quita de las campañas y los perfiles que la tenían. Puedes crear temáticas y editar o borrar las que no son base (las base solo se ocultan). Las nuevas salen de lo que escriben los usuarios sobre sus gustos y quedan pendientes: solo las tiene quien las escribió hasta que las apruebas; si la rechazas, se borra y se quita de su perfil. Una oculta deja de ofrecerse, pero no se quita de los perfiles ni de las campañas que ya la tienen."
      />

      <NuevaTematica />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar temática"
          aria-label="Buscar temática"
          className="w-full max-w-xs rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
        />
        <p className="font-mono text-[12px] text-system-500">
          {formatearNumero(tematicas.length)} {q ? "encontradas" : "en total"} · {formatearNumero(pendientes)} por revisar ·{" "}
          {formatearNumero(deUsuarios)} de usuarios · {formatearNumero(delPanel)} creadas aquí ·{" "}
          {formatearNumero(ocultas)} ocultas · {formatearNumero(etiquetasPorRevisar)} etiquetas por revisar
        </p>
      </form>

      {tematicas.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ninguna temática coincide con «{q}».</p>
      ) : (
        <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
          {tematicas.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className={`break-words font-bold ${t.oculta ? "text-system-500 line-through" : "text-system-900"}`}>{t.nombre}</p>
                <p className="mt-0.5 text-[12px] text-system-500">
                  {t.origen === "base"
                    ? "Base"
                    : `${t.origen === "panel" ? "Creada aquí" : "De un usuario"} · ${fecha.format(new Date(t.creadaEl))}`} ·{" "}
                  {formatearNumero(t.personas)} {t.personas === 1 ? "persona" : "personas"} ·{" "}
                  {formatearNumero(t.campanas)} {t.campanas === 1 ? "campaña" : "campañas"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.bloqueada ? <Tag tone="warn">Bloqueada por el filtro</Tag> : null}
                {t.aprobada ? (
                  <>
                    {t.oculta ? <Tag tone="warn">Oculta</Tag> : null}
                    <BotonDeVisibilidad id={t.id} nombre={t.nombre} oculta={t.oculta} />
                  </>
                ) : (
                  <>
                    <Tag tone="on">Pendiente</Tag>
                    <BotonesDeRevision id={t.id} nombre={t.nombre} />
                  </>
                )}
                {t.origen !== "base" ? (
                  <EditarOBorrar id={t.id} nombre={t.nombre} personas={t.personas} campanas={t.campanas} />
                ) : null}
              </div>
              {t.aprobada ? <EtiquetasDeTematica tematicaId={t.id} tematica={t.nombre} etiquetas={etiquetas.get(t.id) ?? []} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
