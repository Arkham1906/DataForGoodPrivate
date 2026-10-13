"use client";

// Lista de la bandeja de reportes (2026-10-12; desde el 2026-10-13 en /supervisar/reportes y
// /supervision/reportes, antes /reportes), con el mismo patrón que /aportes y la lista de sanciones:
// cada caso (una campaña reportada o un aporte reportado) ocupa un renglón resumen (a quién se reporta,
// cuántos reportes, por qué motivos) aunque tenga uno solo, y al hacer clic se despliegan sus reportes.
// Con reportes pendientes, al pie van "Dar aviso a <persona>" (.../sanciones/[usuarioId]?reportes=<clave>)
// y "Descartar". En escritorio, renglones con rejilla y, al desplegar, una tabla; en móvil, tarjetas.

import Link from "next/link";
import { useState } from "react";

import Tag from "@/components/sistema/Tag";
import { ETIQUETA_DE_ESTADO_DE_REPORTE, type EstadoDeReporte, type TipoDeReporte } from "@/lib/reportes/motivos";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import BotonDescartar from "./BotonDescartar";

/** Lo que llega del servidor: fechas ya formateadas en hora de Tepic. */
export type ReporteParaLista = {
  id: string;
  quien: string;
  motivo: string | null;
  descripcion: string | null;
  fechaTexto: string;
  estado: EstadoDeReporte;
  resueltoTexto: string | null;
  nota: string | null;
  /** "Aviso" o "Baneo", si se confirmó. */
  sancion: string | null;
};

export type GrupoParaLista = {
  /** "campana-116", "aporte-55" o "reporte-9" (aporte borrado: no se resuelve junto). */
  clave: string;
  tipo: TipoDeReporte;
  campana: { id: string; nombre: string };
  aporteId: string | null;
  reportado: { id: string; nombre: string } | null;
  reportes: ReporteParaLista[];
};

const SIN_MOTIVO = "Otro (descrito)";

const TONO: Record<EstadoDeReporte, "warn" | "default" | "danger"> = {
  pendiente: "warn",
  descartado: "default",
  sancionado: "danger",
};

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span aria-hidden="true" className={`inline-block transition-transform motion-reduce:transition-none ${abierto ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

const cuantos = (n: number) => `${n} ${n === 1 ? "reporte" : "reportes"}`;

/** "Campaña «X»" o "Aporte #55 en «X»". */
function titulo(g: GrupoParaLista): string {
  if (g.tipo === "campana") return g.campana.nombre;
  return g.aporteId ? `Aporte #${g.aporteId}` : "Aporte borrado";
}

/** Contra quién va: el creador de la campaña o quien envió el aporte. */
const rolDelReportado = (g: GrupoParaLista) => (g.tipo === "campana" ? "Creador" : "Quien aportó");

/** Motivos con su cantidad, del más repetido al menos: "2 Spam o publicidad". */
function Motivos({ g }: { g: GrupoParaLista }) {
  const conteo = new Map<string, number>();
  for (const r of g.reportes) conteo.set(r.motivo ?? SIN_MOTIVO, (conteo.get(r.motivo ?? SIN_MOTIVO) ?? 0) + 1);
  return (
    <span className="flex flex-wrap gap-1.5">
      {[...conteo.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([motivo, n]) => (
          <Tag key={motivo} tone="warn">
            {n} {motivo}
          </Tag>
        ))}
    </span>
  );
}

/** Pendiente, Sancionado o Descartado. Qué sanción fue lo dice PieDelGrupo (así cabe en un renglón). */
function EstadoDelReporte({ r }: { r: ReporteParaLista }) {
  return <Tag tone={TONO[r.estado]}>{ETIQUETA_DE_ESTADO_DE_REPORTE[r.estado]}</Tag>;
}

/** Cómo se resolvieron (una línea por resolución distinta) o las acciones si sigue pendiente. */
function PieDelGrupo({ g, zona }: { g: GrupoParaLista; zona: ZonaDeModeracion }) {
  const pendientes = g.reportes.some((r) => r.estado === "pendiente");
  if (pendientes) {
    if (g.clave.startsWith("reporte-")) {
      return <p className="text-[12px] text-system-500">El aporte ya se borró: estos reportes no se pueden resolver juntos.</p>;
    }
    return (
      <div className="flex flex-wrap items-start justify-end gap-2.5">
        {g.reportado ? (
          <Link
            href={rutasDeModeracion(zona).sancionar(g.reportado.id, g.clave)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border border-error-700 bg-white px-3.5 py-2 text-[12.5px] font-bold text-error-700 transition-colors hover:bg-error-50"
          >
            Dar aviso a {g.reportado.nombre}
          </Link>
        ) : (
          <p className="text-[12px] text-system-500">La cuenta reportada ya no existe: solo se puede descartar.</p>
        )}
        <BotonDescartar zona={zona} clave={g.clave} caso={titulo(g)} />
      </div>
    );
  }

  const resoluciones = new Map<string, ReporteParaLista>();
  for (const r of g.reportes) resoluciones.set(`${r.estado}|${r.resueltoTexto}|${r.nota}|${r.sancion}`, r);
  const nombre = g.reportado?.nombre ?? "la cuenta";
  return (
    <ul className="space-y-1.5 text-[12px] text-system-600">
      {[...resoluciones.values()].map((r) => (
        <li key={r.id} className="break-words">
          <span className="font-semibold text-system-900">
            {r.estado === "descartado"
              ? "Se descartó"
              : r.sancion === "Baneo"
                ? `Se baneó a ${nombre}`
                : `Se dio un aviso a ${nombre}`}
          </span>
          {r.resueltoTexto ? <span className="font-mono text-[11px] text-system-500"> · {r.resueltoTexto}</span> : null}
          {r.nota ? <span> · {r.nota}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Nombre de la persona reportada, enlazado a su pantalla de sanción (cuántos avisos lleva). */
function Reportado({ g, zona }: { g: GrupoParaLista; zona: ZonaDeModeracion }) {
  if (!g.reportado) return <span className="text-system-500">Cuenta eliminada</span>;
  return (
    <Link href={rutasDeModeracion(zona).sancionar(g.reportado.id)} className="text-system-900 hover:text-brand-600">
      {g.reportado.nombre}
    </Link>
  );
}

export default function ListaDeReportes({ grupos, zona }: { grupos: GrupoParaLista[]; zona: ZonaDeModeracion }) {
  const rutas = rutasDeModeracion(zona);
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
      {/* Móvil: una tarjeta por caso; sus reportes se despliegan dentro. */}
      <div className="space-y-3 md:hidden">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.clave);
          const idPanel = `reportes-movil-${g.clave}`;
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
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                    {g.tipo === "campana" ? "Campaña" : `Aporte en ${g.campana.nombre}`}
                  </span>
                  <span className="block break-words text-[14px] font-bold leading-snug text-system-900">{titulo(g)}</span>
                  <span className="mt-1 block text-[12px] text-system-600">
                    {rolDelReportado(g)}: {g.reportado?.nombre ?? "Cuenta eliminada"}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-system-500">Último: {g.reportes[0].fechaTexto}</span>
                  <span className="mt-2 block"><Motivos g={g} /></span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-brand-600">
                  {g.reportes.length} <Chevron abierto={abierto} />
                </span>
              </button>
              {abierto && (
                <div id={idPanel} className="space-y-3 border-t border-system-200 bg-system-50 p-3">
                  <Link href={rutas.campana(g.campana.id)} className="block text-[12px] font-semibold text-brand-600 hover:underline">
                    Ver la campaña
                  </Link>
                  {g.reportes.map((r) => (
                    <TarjetaDeReporte key={r.id} r={r} />
                  ))}
                  <PieDelGrupo g={g} zona={zona} />
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Escritorio: un renglón por caso (sin columnas vacías); al desplegar, la tabla de sus
          reportes con sus propios encabezados. Misma rejilla en todos los renglones: nada brinca. */}
      <div className="hidden divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm md:block">
        {grupos.map((g) => {
          const abierto = abiertos.has(g.clave);
          const idPanel = `reportes-${g.clave}`;
          return (
            <section key={g.clave} aria-label={`Reportes de ${titulo(g)}`}>
              <div
                className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)_104px] items-start gap-4 px-5 py-4 ${
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
                    <span className="block font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-system-500">
                      {g.tipo === "campana" ? "Campaña" : "Aporte"}
                    </span>
                    {titulo(g)}
                    {g.tipo === "aporte" && (
                      <span className="block text-[11.5px] font-normal text-system-600">en {g.campana.nombre}</span>
                    )}
                    <span className="block text-[11.5px] font-semibold text-brand-600">{cuantos(g.reportes.length)}</span>
                    <span className="block font-mono text-[11px] font-normal text-system-500">Último: {g.reportes[0].fechaTexto}</span>
                  </span>
                </button>
                <div className="min-w-0 break-words text-[12.5px]">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">{rolDelReportado(g)}</span>
                  <span className="mt-1 block"><Reportado g={g} zona={zona} /></span>
                </div>
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">Motivos</span>
                  <span className="mt-1 block"><Motivos g={g} /></span>
                </div>
                <div className="text-right">
                  <Link href={rutas.campana(g.campana.id)} className="whitespace-nowrap text-[12.5px] font-semibold text-brand-600 hover:underline">
                    Ver campaña<span className="sr-only"> {g.campana.nombre}</span>
                  </Link>
                </div>
              </div>

              {abierto && (
                <div id={idPanel} className="overflow-x-auto border-t border-system-200 bg-system-50 px-5 pb-4 pt-3">
                  <table className="w-full min-w-[720px] table-fixed text-left text-[12.5px]">
                    <colgroup>
                      <col className="w-[14%]" />
                      <col className="w-[17%]" />
                      <col className="w-[22%]" />
                      <col className="w-[31%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">Fecha</th>
                        <th className="pb-2 pr-3 font-medium">Reportó</th>
                        <th className="pb-2 pr-3 font-medium">Motivo</th>
                        <th className="pb-2 pr-3 font-medium">Descripción</th>
                        <th className="pb-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.reportes.map((r) => (
                        <tr key={r.id} className="border-b border-system-200 align-top last:border-0">
                          <td className="py-3 pr-3 font-mono text-[11px] text-system-500">{r.fechaTexto}</td>
                          <td className="break-words py-3 pr-3 text-system-900">{r.quien}</td>
                          <td className="break-words py-3 pr-3 text-system-600">{r.motivo ?? SIN_MOTIVO}</td>
                          <td className="break-words py-3 pr-3 text-system-600">{r.descripcion ?? "—"}</td>
                          <td className="py-3"><EstadoDelReporte r={r} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 border-t border-system-200 pt-3">
                    <PieDelGrupo g={g} zona={zona} />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Tarjeta de móvil de un reporte, dentro de un caso desplegado. */
function TarjetaDeReporte({ r }: { r: ReporteParaLista }) {
  return (
    <article className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-mono text-[11px] text-system-500">{r.fechaTexto}</p>
        <EstadoDelReporte r={r} />
      </div>
      <dl className="mt-3 space-y-3 border-t border-system-200 pt-3">
        <div>
          <dt className="text-[11px] text-system-600">Motivo</dt>
          <dd className="mt-0.5 break-words text-[12.5px] text-system-900">{r.motivo ?? SIN_MOTIVO}</dd>
        </div>
        {r.descripcion && (
          <div>
            <dt className="text-[11px] text-system-600">Descripción</dt>
            <dd className="mt-0.5 break-words text-[12.5px] text-system-900">{r.descripcion}</dd>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-system-600">Reportó</dt>
          <dd className="text-right text-[12.5px] text-system-900">{r.quien}</dd>
        </div>
      </dl>
    </article>
  );
}
