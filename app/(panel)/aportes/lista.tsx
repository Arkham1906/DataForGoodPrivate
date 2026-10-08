"use client";

// Lista de la bandeja /aportes agrupada por persona (2026-10-08), como /usuarios/sanciones: cada
// participante (con cuenta, o anónimo desde un mismo dispositivo) ocupa un renglón resumen
// (cuántos aportes, a qué campañas, en qué etapa) y al hacer clic se despliegan sus aportes.
// En escritorio, renglones por persona y, al desplegar, una tabla con sus aportes; en móvil, tarjetas.

import Link from "next/link";
import { useState } from "react";

import Tag from "@/components/sistema/Tag";
import type { FilaDeAporte, GrupoDeAportes } from "@/lib/aportes/bandeja";

// enviadoEn ya viene en hora de Tepic: se formatea en UTC para no moverla.
const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

function formatearEnvio(enviadoEn: string): string {
  const [dia, hora] = enviadoEn.split("T");
  const [y, m, d] = dia.split("-").map(Number);
  return `${FECHA.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "")} · ${hora}`;
}

const SIN_REGISTRO = "Vía enlace público, sin registro";

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-block transition-transform motion-reduce:transition-none ${abierto ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

const cuantos = (n: number) => `${n} ${n === 1 ? "aporte" : "aportes"}`;

/** Etiquetas de etapa con su cantidad: "2 Aceptado", "1 Sin revisar". */
function Etapas({ g }: { g: GrupoDeAportes }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {g.porEtapa.map((e) => (
        <Tag key={e.texto} tone={e.tono}>
          {e.n} {e.texto}
        </Tag>
      ))}
    </span>
  );
}

/** El nombre de la campaña si es una sola; si son varias, cuántas. */
function Campanas({ g }: { g: GrupoDeAportes }) {
  if (g.campanas.length === 1) {
    const c = g.campanas[0];
    return (
      <Link href={`/sistema/campanas/${c.id}`} className="text-system-900 hover:text-brand-600">
        {c.nombre}
      </Link>
    );
  }
  return <span className="text-system-600">{g.campanas.length} campañas</span>;
}

/** Aviso al final de un grupo con más aportes de los que se traen. */
function Faltan({ g }: { g: GrupoDeAportes }) {
  if (g.total <= g.aportes.length) return null;
  return (
    <>Se muestran los {g.aportes.length} más recientes de {g.total}. Filtra por campaña o por etapa para ver otros.</>
  );
}

export default function ListaDeAportes({ grupos }: { grupos: GrupoDeAportes[] }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });

  return (
    <>
      {/* Móvil: una tarjeta por persona; sus aportes se despliegan dentro. */}
      <div className="space-y-3 md:hidden">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.clave);
          const idPanel = `aportes-movil-${g.clave}`;
          return (
            <article key={g.clave} className="rounded-lg border border-system-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => alternar(g.clave)}
                aria-expanded={abierto}
                aria-controls={idPanel}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block break-words text-[14px] font-bold leading-snug text-system-900">{g.participante}</span>
                  <span className="mt-1 block text-[12px] text-system-600">
                    {g.campanas.length === 1 ? g.campanas[0].nombre : `${g.campanas.length} campañas`}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-system-500">Último: {formatearEnvio(g.ultimoEnvio)}</span>
                  <span className="mt-2 block"><Etapas g={g} /></span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-brand-600">
                  {g.total} <Chevron abierto={abierto} />
                </span>
              </button>
              {abierto && (
                <div id={idPanel} className="space-y-3 border-t border-system-200 bg-system-50 p-3">
                  {g.usuarioId && (
                    <Link href={`/usuarios/${g.usuarioId}`} className="block text-[12px] font-semibold text-brand-600 hover:underline">
                      Ver ficha de {g.participante}
                    </Link>
                  )}
                  {g.aportes.map((a) => (
                    <TarjetaDeAporte key={a.id} a={a} />
                  ))}
                  <p className="text-[12px] text-system-500"><Faltan g={g} /></p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Escritorio: un renglón por persona (sin columnas vacías); al desplegar, la tabla de sus
          aportes con sus propios encabezados. La rejilla es la misma en todos los renglones, así
          que nada brinca al abrir uno. */}
      <div className="hidden divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm md:block">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.clave);
          const idPanel = `aportes-${g.clave}`;
          return (
            <section key={g.clave} aria-label={`Aportes de ${g.participante}`}>
              <div
                className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_88px] items-start gap-4 px-5 py-4 ${
                  abierto ? "bg-system-50" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => alternar(g.clave)}
                  aria-expanded={abierto}
                  aria-controls={idPanel}
                  className="flex min-w-0 items-start gap-2 text-left text-[13.5px] font-bold text-system-900 hover:text-brand-600"
                >
                  <Chevron abierto={abierto} />
                  <span className="min-w-0 break-words">
                    {g.participante}
                    <span className="block text-[11.5px] font-semibold text-brand-600">{cuantos(g.total)}</span>
                    <span className="block font-mono text-[11px] font-normal text-system-500">
                      Último: {formatearEnvio(g.ultimoEnvio)}
                    </span>
                  </span>
                </button>
                <div className="min-w-0 break-words text-[12.5px]">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                    {g.campanas.length === 1 ? "Campaña" : "Campañas"}
                  </span>
                  <span className="mt-1 block"><Campanas g={g} /></span>
                </div>
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">Etapas</span>
                  <span className="mt-1 block"><Etapas g={g} /></span>
                </div>
                <div className="text-right">
                  {g.usuarioId ? (
                    <Link href={`/usuarios/${g.usuarioId}`} className="whitespace-nowrap text-[12.5px] font-semibold text-brand-600 hover:underline">
                      Ver ficha<span className="sr-only"> de {g.participante}</span>
                    </Link>
                  ) : (
                    <span className="text-[12px] text-system-500">Sin cuenta</span>
                  )}
                </div>
              </div>

              {abierto && (
                <div id={idPanel} className="overflow-x-auto border-t border-system-200 bg-system-50 px-5 pb-4 pt-3">
                  <table className="w-full min-w-[720px] table-fixed text-left text-[12.5px]">
                    <colgroup>
                      <col className="w-[14%]" />
                      <col className="w-[24%]" />
                      <col className="w-[36%]" />
                      <col className="w-[11%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">Enviado</th>
                        <th className="pb-2 pr-3 font-medium">Campaña</th>
                        <th className="pb-2 pr-3 font-medium">Descripción</th>
                        <th className="pb-2 pr-3 font-medium">Tipo</th>
                        <th className="pb-2 font-medium">Etapa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.aportes.map((a) => (
                        <RenglonDeAporte key={a.id} a={a} />
                      ))}
                    </tbody>
                  </table>
                  {g.total > g.aportes.length && (
                    <p className="mt-3 text-[12px] text-system-500"><Faltan g={g} /></p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Un aporte en la tabla de una persona desplegada. */
function RenglonDeAporte({ a }: { a: FilaDeAporte }) {
  return (
    <tr className="border-b border-system-200 align-top last:border-0">
      <td className="py-3 pr-3 font-mono text-[11px] text-system-500">{formatearEnvio(a.enviadoEn)}</td>
      <td className="break-words py-3 pr-3">
        <Link href={`/sistema/campanas/${a.campanaId}`} className="text-system-900 hover:text-brand-600">
          {a.campana}
        </Link>
      </td>
      <td className="break-words py-3 pr-3 text-system-600">{a.resumen ?? SIN_REGISTRO}</td>
      <td className="py-3 pr-3 text-system-600">{a.tipo}</td>
      <td className="py-3">
        <Tag tone={a.etapa.tono}>{a.etapa.texto}</Tag>
      </td>
    </tr>
  );
}

/** Tarjeta de móvil de un aporte, dentro de una persona desplegada. */
function TarjetaDeAporte({ a }: { a: FilaDeAporte }) {
  return (
    <article className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-mono text-[11px] text-system-500">{formatearEnvio(a.enviadoEn)}</p>
        <Tag tone={a.etapa.tono}>{a.etapa.texto}</Tag>
      </div>

      <p className="mt-3 break-words border-t border-system-200 pt-3 text-[12.5px] text-system-600">
        {a.resumen ?? SIN_REGISTRO}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-system-600">Campaña</dt>
          <dd className="mt-0.5 break-words text-[12.5px] text-system-900">
            <Link href={`/sistema/campanas/${a.campanaId}`} className="hover:text-brand-600">
              {a.campana}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-system-600">Tipo</dt>
          <dd className="mt-0.5 text-[12.5px] text-system-900">{a.tipo}</dd>
        </div>
      </dl>
    </article>
  );
}
