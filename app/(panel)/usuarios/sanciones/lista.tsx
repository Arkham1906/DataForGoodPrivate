"use client";

// Lista de /usuarios/sanciones (2026-10-08). Cada usuario ocupa un renglón resumen (cuántas, de qué
// tipo, la más reciente), aunque tenga una sola sanción, para que todos se vean igual; al hacer clic
// se despliegan sus sanciones. Tabla en escritorio y tarjetas en móvil, como el resto del panel.

import Link from "next/link";
import { useState } from "react";

import Tag from "@/components/sistema/Tag";
import type { RegistroDeSancion } from "@/lib/usuarios/directorio";
import BotonRestaurar from "./boton-restaurar";

/** Lo que llega del servidor: la fecha ya formateada (en hora de Tepic). */
export type SancionParaLista = Omit<RegistroDeSancion, "fecha"> & { fechaTexto: string };

const ETIQUETA: Record<RegistroDeSancion["tipo"], { texto: string; plural: string; tono: "warn" | "danger" }> = {
  STRIKE: { texto: "Strike", plural: "Strikes", tono: "warn" },
  SUSPENSION: { texto: "Suspensión", plural: "Suspensiones", tono: "warn" },
  BANEO: { texto: "Baneo", plural: "Baneos", tono: "danger" },
  BANEO_EN_CAMPANA: { texto: "Baneo en campaña", plural: "Baneos en campaña", tono: "danger" },
};

/** Strike, Suspensión (con sus días), Baneo o Baneo en campaña. */
function EtiquetaDeSancion({ s }: { s: SancionParaLista }) {
  const e = ETIQUETA[s.tipo];
  return (
    <Tag tone={s.vigente ? e.tono : "default"}>
      {e.texto}
      {s.tipo === "SUSPENSION" ? ` · ${s.dias} ${s.dias === 1 ? "día" : "días"}` : ""}
    </Tag>
  );
}

/** La campaña y el aporte que la originaron, o "Toda la cuenta". */
function DondeSeAplico({ s }: { s: SancionParaLista }) {
  if (s.tipo !== "BANEO_EN_CAMPANA") return <span className="text-system-500">Toda la cuenta</span>;
  return (
    <>
      {s.campana ? (
        <Link href={`/sistema/campanas/${s.campana.id}`} className="hover:text-brand-600">
          {s.campana.nombre}
        </Link>
      ) : (
        "Campaña eliminada"
      )}
      {s.aporteId && <span className="block font-mono text-[11px] text-system-500">Por el aporte #{s.aporteId}</span>}
    </>
  );
}

/** "2 Strikes · 1 Baneo en campaña", en el orden de ETIQUETA. */
function resumenDeTipos(sanciones: SancionParaLista[]): string {
  return (Object.keys(ETIQUETA) as RegistroDeSancion["tipo"][])
    .map((tipo) => {
      const n = sanciones.filter((s) => s.tipo === tipo).length;
      return n === 0 ? null : `${n} ${n === 1 ? ETIQUETA[tipo].texto : ETIQUETA[tipo].plural}`;
    })
    .filter(Boolean)
    .join(" · ");
}

type Grupo = { usuarioId: string; usuario: string; sanciones: SancionParaLista[] };

/** Agrupa por usuario conservando el orden: primero quien tiene la sanción más reciente. */
function agrupar(sanciones: SancionParaLista[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const s of sanciones) {
    const g = grupos.get(s.usuarioId) ?? { usuarioId: s.usuarioId, usuario: s.usuario, sanciones: [] };
    g.sanciones.push(s);
    grupos.set(s.usuarioId, g);
  }
  return [...grupos.values()];
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-block transition-transform motion-reduce:transition-none ${abierto ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

const claseEstado = (vigente: boolean) =>
  `text-[12.5px] ${vigente ? "font-semibold text-system-900" : "text-system-500"}`;

export default function ListaDeSanciones({ sanciones }: { sanciones: SancionParaLista[] }) {
  const grupos = agrupar(sanciones);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (usuarioId: string) =>
    setAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(usuarioId)) nuevo.delete(usuarioId);
      else nuevo.add(usuarioId);
      return nuevo;
    });

  return (
    <>
      {/* Móvil: una tarjeta por usuario; sus sanciones se despliegan dentro. */}
      <div className="space-y-3 md:hidden">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.usuarioId);
          const vigentes = g.sanciones.filter((s) => s.vigente).length;
          const idPanel = `sanciones-movil-${g.usuarioId}`;
          return (
            <article key={g.usuarioId} className="rounded-lg border border-system-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => alternar(g.usuarioId)}
                aria-expanded={abierto}
                aria-controls={idPanel}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block break-words text-[14px] font-bold leading-snug text-system-900">{g.usuario}</span>
                  <span className="mt-1 block text-[12px] text-system-600">{resumenDeTipos(g.sanciones)}</span>
                  <span className="mt-1 block text-[11px] text-system-500">
                    {vigentes} {vigentes === 1 ? "vigente" : "vigentes"} · {g.sanciones.length === 1 ? "" : "la más reciente: "}
                    {g.sanciones[0].fechaTexto}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-brand-600">
                  {g.sanciones.length} <Chevron abierto={abierto} />
                </span>
              </button>
              {abierto && (
                <div id={idPanel} className="space-y-3 border-t border-system-200 bg-system-50 p-3">
                  <Link href={`/usuarios/${g.usuarioId}`} className="block text-[12px] font-semibold text-brand-600 hover:underline">
                    Ver ficha de {g.usuario}
                  </Link>
                  {g.sanciones.map((s) => (
                    <TarjetaDeSancion key={s.id} s={s} />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Escritorio: tabla; cada usuario es su propio <tbody>. Anchos fijos (table-fixed + colgroup):
          si no, al desplegar el navegador recalcula las columnas y todo brinca. */}
      <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
        <table className="w-full min-w-[880px] table-fixed text-left text-[13.5px]">
          {/* En porcentaje y sumando 100 %: con anchos en px que no caben, la columna libre queda en 0. */}
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
            <tr>
              <th className="pb-3 pr-3 font-medium">Usuario</th>
              <th className="pb-3 pr-3 font-medium">Tipo</th>
              <th className="pb-3 pr-3 font-medium">Motivo</th>
              <th className="pb-3 pr-3 font-medium">Campaña</th>
              <th className="pb-3 pr-3 font-medium">Aplicó</th>
              <th className="pb-3 pr-3 font-medium">Fecha</th>
              <th className="pb-3 pr-3 font-medium">Estado</th>
              <th className="pb-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          {grupos.map((g) => {
            const abierto = abiertos.has(g.usuarioId);
            const vigentes = g.sanciones.filter((s) => s.vigente).length;
            return (
              <tbody key={g.usuarioId} className="border-b border-system-200 last:border-0">
                <tr className={`align-top ${abierto ? "bg-system-50" : ""}`}>
                  <td className="py-4 pr-3">
                    <button
                      type="button"
                      onClick={() => alternar(g.usuarioId)}
                      aria-expanded={abierto}
                      className="flex items-start gap-2 text-left font-bold text-system-900 hover:text-brand-600"
                    >
                      <Chevron abierto={abierto} />
                      <span className="min-w-0 break-words">
                        {g.usuario}
                        <span className="block text-[11.5px] font-semibold text-brand-600">
                          {g.sanciones.length} {g.sanciones.length === 1 ? "sanción" : "sanciones"}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td colSpan={4} className="py-4 pr-3 text-system-600">{resumenDeTipos(g.sanciones)}</td>
                  <td className="py-4 pr-3 font-mono text-[11px] text-system-500">{g.sanciones[0].fechaTexto}</td>
                  <td className={`py-4 pr-3 ${claseEstado(vigentes > 0)}`}>
                    {vigentes} {vigentes === 1 ? "vigente" : "vigentes"}
                  </td>
                  <td className="py-4 text-right">
                    <Link href={`/usuarios/${g.usuarioId}`} className="whitespace-nowrap text-[12.5px] font-semibold text-brand-600 hover:underline">
                      Ver ficha<span className="sr-only"> de {g.usuario}</span>
                    </Link>
                  </td>
                </tr>
                {abierto && g.sanciones.map((s) => <FilaDeSancion key={s.id} s={s} />)}
              </tbody>
            );
          })}
        </table>
      </div>
    </>
  );
}

/** Un renglón de la tabla, dentro de un usuario desplegado (el nombre ya está arriba). */
function FilaDeSancion({ s }: { s: SancionParaLista }) {
  return (
    <tr className="border-t border-system-200 bg-system-50 align-top">
      <td className="py-4 pl-6 pr-3">
        <span className="sr-only">{s.usuario}</span>
      </td>
      <td className="py-4 pr-3"><EtiquetaDeSancion s={s} /></td>
      <td className="break-words py-4 pr-3 text-system-600">{s.motivo}</td>
      <td className="break-words py-4 pr-3 text-system-600"><DondeSeAplico s={s} /></td>
      <td className="break-words py-4 pr-3 text-system-600">{s.quien}</td>
      <td className="py-4 pr-3 font-mono text-[11px] text-system-500">{s.fechaTexto}</td>
      <td className={`py-4 pr-3 ${claseEstado(s.vigente)}`}>{s.estado}</td>
      <td className="py-4 text-right">
        {s.restaurable && s.sancionId && <BotonRestaurar sancionId={s.sancionId} usuario={s.usuario} />}
      </td>
    </tr>
  );
}

/** Tarjeta de móvil, dentro de un usuario desplegado. */
function TarjetaDeSancion({ s }: { s: SancionParaLista }) {
  return (
    <article className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[11px] text-system-500">{s.fechaTexto}</p>
        <EtiquetaDeSancion s={s} />
      </div>

      <dl className="mt-3 space-y-3 border-t border-system-200 pt-3">
        <div>
          <dt className="text-[11px] text-system-600">Motivo</dt>
          <dd className="mt-1 break-words text-[13px] leading-relaxed text-system-900">{s.motivo}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-system-600">Campaña</dt>
          <dd className="mt-1 break-words text-[13px] text-system-900"><DondeSeAplico s={s} /></dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-system-600">Aplicó</dt>
          <dd className="text-right text-[13px] text-system-900">{s.quien}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-system-600">Estado</dt>
          <dd className={`text-right ${claseEstado(s.vigente)}`}>{s.estado}</dd>
        </div>
      </dl>

      {s.restaurable && s.sancionId && (
        <div className="mt-3 grid">
          <BotonRestaurar sancionId={s.sancionId} usuario={s.usuario} anchoCompleto />
        </div>
      )}
    </article>
  );
}
