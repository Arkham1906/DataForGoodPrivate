"use client";

// Lista de la bandeja /aportes agrupada por persona (2026-10-08), como la lista de sanciones: cada
// participante (con cuenta, o anónimo desde un mismo dispositivo) ocupa un renglón resumen
// (cuántos aportes, a qué campañas, en qué etapa) y al hacer clic se despliegan sus aportes.
// En escritorio, renglones como la vista de lista de Mis aportes (components/sistema/Renglones, 2026-11-25): uno por
// persona y, al desplegar, uno por aporte; en móvil, tarjetas.
// Los grupos abiertos se recuerdan en sessionStorage (2026-11-23, a pedido del usuario): al regresar de una campaña
// o de una ficha siguen abiertos. No van en la URL porque la clave de un grupo sin cuenta lleva el id del dispositivo.

import Link from "next/link";
import { useSyncExternalStore } from "react";

import Tag from "@/components/sistema/Tag";
import { ListaDeRenglones, Renglon, RenglonDesplegable } from "@/components/sistema/Renglones";
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

/** Aviso al final de un grupo con más aportes de los que se traen. */
function Faltan({ g }: { g: GrupoDeAportes }) {
  if (g.total <= g.aportes.length) return null;
  return (
    <>Se muestran los {g.aportes.length} más recientes de {g.total}. Filtra por campaña o por etapa para ver otros.</>
  );
}

const CLAVE_ABIERTOS = "dfg:panel:aportes:abiertos";
const EVENTO_ABIERTOS = "dfg:panel:aportes:abiertos";
/** Cuántos grupos abiertos se recuerdan como máximo (los más recientes). */
const MAXIMO_ABIERTOS = 50;

/** Respaldo en memoria si el navegador no deja usar sessionStorage: los grupos se abren igual, sin recordarse. */
let abiertosEnMemoria = "";

function leerAbiertos(): string {
  try {
    return sessionStorage.getItem(CLAVE_ABIERTOS) ?? "";
  } catch {
    return abiertosEnMemoria;
  }
}

function guardarAbiertos(lista: string[]) {
  abiertosEnMemoria = JSON.stringify(lista.slice(-MAXIMO_ABIERTOS));
  try {
    sessionStorage.setItem(CLAVE_ABIERTOS, abiertosEnMemoria);
  } catch {
    // Queda el respaldo en memoria.
  }
  window.dispatchEvent(new Event(EVENTO_ABIERTOS));
}

function suscribirAbiertos(alCambiar: () => void) {
  window.addEventListener(EVENTO_ABIERTOS, alCambiar);
  return () => window.removeEventListener(EVENTO_ABIERTOS, alCambiar);
}

function listaDeAbiertos(crudo: string): string[] {
  try {
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export default function ListaDeAportes({ grupos }: { grupos: GrupoDeAportes[] }) {
  // En el servidor y al hidratar, todos cerrados; los recordados se abren justo después.
  const crudo = useSyncExternalStore(suscribirAbiertos, leerAbiertos, () => "");
  const abiertos = new Set(listaDeAbiertos(crudo));
  const alternar = (clave: string) => {
    const lista = listaDeAbiertos(leerAbiertos()).filter((c) => c !== clave);
    if (!abiertos.has(clave)) lista.push(clave);
    guardarAbiertos(lista);
  };

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

      {/* Escritorio (2026-11-25): renglones como la vista de lista de Mis aportes. Cada persona es un renglón que
          se despliega y, dentro, un renglón por aporte (antes una rejilla y una tabla con encabezados). */}
      <ListaDeRenglones etiqueta="Aportes agrupados por persona" soloEscritorio>
        {grupos.map((g) => {
          const abierto = abiertos.has(g.clave);
          return (
            <RenglonDesplegable
              key={g.clave}
              abierto={abierto}
              alAlternar={() => alternar(g.clave)}
              idPanel={`aportes-${g.clave}`}
              titulo={g.participante}
              rotulo={cuantos(g.total)}
              detalles={[
                g.campanas.length === 1 ? g.campanas[0].nombre : `${g.campanas.length} campañas`,
                `Último: ${formatearEnvio(g.ultimoEnvio)}`,
              ]}
              lateral={
                <>
                  <Etapas g={g} />
                  {g.usuarioId ? (
                    <Link href={`/usuarios/${g.usuarioId}`} className="whitespace-nowrap text-[12px] font-semibold text-brand-600 hover:underline">
                      Ver ficha<span className="sr-only"> de {g.participante}</span>
                    </Link>
                  ) : (
                    <span className="text-[11px] text-system-500">Sin cuenta</span>
                  )}
                </>
              }
            >
              <ListaDeRenglones etiqueta={`Aportes de ${g.participante}`}>
                {g.aportes.map((a) => (
                  <RenglonDeAporte key={a.id} a={a} />
                ))}
              </ListaDeRenglones>
              {g.total > g.aportes.length && (
                <p className="mt-3 text-[12px] text-system-500"><Faltan g={g} /></p>
              )}
            </RenglonDesplegable>
          );
        })}
      </ListaDeRenglones>
    </>
  );
}

/** Un aporte dentro de una persona desplegada: como un renglón de Mis aportes (campaña, tipo, resumen, fecha y etapa). */
function RenglonDeAporte({ a }: { a: FilaDeAporte }) {
  return (
    <Renglon
      titulo={
        <Link href={`/sistema/campanas/${a.campanaId}`} className="hover:text-brand-600">
          {a.campana}
        </Link>
      }
      rotulo={a.tipo}
      detalles={[a.resumen ?? SIN_REGISTRO, formatearEnvio(a.enviadoEn)]}
      lateral={<Tag tone={a.etapa.tono}>{a.etapa.texto}</Tag>}
    />
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
