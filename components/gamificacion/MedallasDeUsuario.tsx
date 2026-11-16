"use client";

// Pestaña Medallas (2026-11-15; lienzo aprobado el mismo día; RF-GAM-46 a 49), en /progreso/medallas: encabezado con
// el resumen y «Más cerca de subir», y las medallas por grupo del catálogo, en el orden del catálogo (decisión del
// 2026-11-15). Cada tarjeta y cada medalla de «Más cerca de subir» abren FichaDeMedalla.
// Tarjeta: ilustración del nivel visible (sin nivel, la del nivel 1 en gris), estado, una marca por nivel, qué mide y
// el avance hacia el siguiente nivel. Movimiento: la tarjeta sube 2 px al pasar el puntero (solo con puntero fino) y se
// encoge un poco al pulsarla; con movimiento reducido, nada se mueve.

import { useState } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import { GRUPOS_DE_MEDALLA, type MedallaCercaDeSubir, type MedallaEnPantalla } from "@/lib/gamificacion/medallas";
import { imagenDeMedalla } from "@/lib/gamificacion/recursos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import FichaDeMedalla, { TONO_DE_ESTADO, estadoDeMedalla, imagenVisible } from "./FichaDeMedalla";

const T = TEXTOS.medallas;

function Tarjeta({ m, abrir }: { m: MedallaEnPantalla; abrir: () => void }) {
  const estado = estadoDeMedalla(m);
  const proximo = m.niveles[m.nivel] ?? null;
  const siguiente = proximo ? T.para(proximo.nombre) : T.completa;
  const avance = proximo ? T.avance(m.valor, proximo.umbral) : m.valor.toLocaleString("es-MX");
  const pct = proximo ? Math.round((m.valor / proximo.umbral) * 100) : 100;
  return (
    <button
      type="button"
      onClick={abrir}
      aria-haspopup="dialog"
      aria-label={T.tarjetaAria(m.nombre, estado.texto, siguiente, avance)}
      className="flex h-full w-full flex-col items-center gap-2.5 rounded-lg border border-system-200 bg-white px-[18px] pt-5 pb-[18px] text-center transition-[transform,border-color,box-shadow] duration-150 ease-salida hover:border-brand-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:hover:-translate-y-0.5 motion-reduce:pointer-fine:hover:translate-y-0 max-md:grid max-md:grid-cols-[72px_minmax(0,1fr)] max-md:items-center max-md:gap-x-3 max-md:gap-y-1 max-md:px-3 max-md:py-2.5 max-md:text-left"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en public/ */}
      <img
        src={imagenVisible(m)}
        alt=""
        width={112}
        height={112}
        className={`h-28 w-28 max-md:row-span-4 max-md:h-[72px] max-md:w-[72px] ${m.nivel === 0 ? "opacity-45 grayscale" : ""}`}
      />
      <span className="flex flex-col items-center gap-1.5 max-md:items-start max-md:gap-1">
        <strong className="text-[17px] font-extrabold text-system-900 max-md:text-[15px]">{m.nombre}</strong>
        <span className={`rounded-[8px] px-2.5 py-0.5 text-[12.5px] font-bold max-md:px-2 max-md:text-xs ${TONO_DE_ESTADO[estado.tono]}`}>{estado.texto}</span>
      </span>
      <span aria-hidden="true" className="flex gap-1 max-md:hidden">
        {m.niveles.map((n) => (
          <span
            key={n.nivel}
            className={`h-[5px] w-[18px] rounded-pill ${n.nivel <= m.nivel ? "bg-success-700" : n.nivel === m.nivel + 1 ? "bg-brand-200" : "bg-system-200"}`}
          />
        ))}
      </span>
      {m.queMide && <span className="text-[12.5px] leading-snug text-system-600 max-md:hidden">{m.queMide}</span>}
      <span className="mt-auto flex w-full flex-col gap-1.5 max-md:mt-0">
        <span className="flex justify-between gap-2 text-[12.5px] max-md:text-xs">
          <span className="text-system-700">{siguiente}</span>
          <span className="font-mono font-bold text-system-900">{avance}</span>
        </span>
        <ProgressBar pct={pct} tone="ok" />
      </span>
    </button>
  );
}

export default function MedallasDeUsuario({ medallas, cerca }: { medallas: MedallaEnPantalla[]; cerca: MedallaCercaDeSubir[] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const grupos = GRUPOS_DE_MEDALLA.map((g) => ({ clave: g, medallas: medallas.filter((m) => m.grupo === g) })).filter((g) => g.medallas.length > 0);

  return (
    <>
      <Encabezado medallas={medallas} cerca={cerca} abrir={setAbierta} />
      {grupos.map((g) => {
        const con = g.medallas.filter((m) => m.nivel > 0).length;
        return (
          <section key={g.clave} aria-labelledby={`medallas-${g.clave}`} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 id={`medallas-${g.clave}`} className="text-xl font-extrabold text-system-900 max-md:text-lg">
                {T.grupos[g.clave] ?? g.clave}
              </h2>
              <span className="text-[13px] text-system-600 max-md:text-xs">{T.resumenDeGrupo(con, g.medallas.length)}</span>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5 max-md:grid-cols-1 max-md:gap-2">
              {g.medallas.map((m) => (
                <li key={m.clave} className="flex">
                  <Tarjeta m={m} abrir={() => setAbierta(m.clave)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <FichaDeMedalla medallas={medallas} abierta={abierta} onIr={setAbierta} onCerrar={() => setAbierta(null)} />
    </>
  );
}

/** Encabezado oscuro: medallas con nivel, niveles desbloqueados y «Más cerca de subir» (abre la misma ficha). */
function Encabezado({
  medallas,
  cerca,
  abrir,
}: {
  medallas: MedallaEnPantalla[];
  cerca: MedallaCercaDeSubir[];
  abrir: (clave: string) => void;
}) {
  const conNivel = medallas.filter((m) => m.nivel > 0).length;
  const niveles = medallas.reduce((s, m) => s + m.nivel, 0);
  const totalDeNiveles = medallas.reduce((s, m) => s + m.niveles.length, 0);
  return (
    <section aria-labelledby="medallas-titulo" className="flex flex-col gap-5 rounded-lg bg-brand-950 p-6 text-white max-md:gap-4 max-md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-6 max-md:gap-4">
        <div className="min-w-0 flex-[1_1_360px]">
          <h2 id="medallas-titulo" className="text-[26px] leading-tight font-extrabold max-md:text-[22px]">
            {T.titulo}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-brand-200">{conNivel === 0 ? `${T.intro} ${T.introNueva}` : T.intro}</p>
        </div>
        <div className="grid flex-[0_1_340px] grid-cols-2 gap-3 rounded-lg bg-brand-900 px-5 py-4 max-md:flex-auto max-md:gap-2 max-md:bg-transparent max-md:p-0">
          {[
            { valor: conNivel, total: medallas.length, etiqueta: T.conNivel },
            { valor: niveles, total: totalDeNiveles, etiqueta: T.niveles },
          ].map((d) => (
            <p key={d.etiqueta} className="flex flex-col gap-0.5 max-md:rounded-lg max-md:bg-brand-900 max-md:px-3 max-md:py-2.5">
              <span className="font-mono text-[26px] leading-none font-bold max-md:text-[22px]">
                {d.valor}
                <span className="text-[15px] text-brand-200 max-md:text-[13px]">{T.deTotal(d.total)}</span>
              </span>
              <span className="text-[12.5px] text-brand-100 max-md:text-xs">{d.etiqueta}</span>
            </p>
          ))}
        </div>
      </div>
      {cerca.length > 0 && <CercaDeSubir cerca={cerca} abrir={abrir} />}
    </section>
  );
}

/** «Más cerca de subir»: las mismas tres de Inicio (medallasMasCercanas). */
function CercaDeSubir({ cerca, abrir }: { cerca: MedallaCercaDeSubir[]; abrir: (clave: string) => void }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[15px] font-bold text-brand-100 max-md:text-sm">{T.cerca}</h3>      <ul className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 max-md:grid-cols-1 max-md:gap-2">
        {cerca.map((k) => (
          <li key={k.clave}>
            <button
              type="button"
              onClick={() => abrir(k.clave)}
              aria-haspopup="dialog"
              className="flex w-full items-center gap-3.5 rounded-lg border border-brand-800 bg-brand-900 px-3.5 py-3 text-left transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-200 max-md:gap-3 max-md:py-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en public/ */}
              <img
                src={imagenDeMedalla(k.clave, k.imagen.nivel, k.imagen.nombre, 128, k.imagen.ilustracion)}
                alt=""
                width={56}
                height={56}
                className={`h-14 w-14 shrink-0 max-md:h-11 max-md:w-11 ${k.bloqueada ? "opacity-45 grayscale" : ""}`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <strong className="text-[14.5px] max-md:text-sm">{k.nombre}</strong>
                <span className="text-[12.5px] text-brand-100 max-md:text-xs">{T.faltanPara(k.umbral - k.valor, k.nivelSiguiente)}</span>
                <span className="block h-1.5 overflow-hidden rounded-pill bg-brand-800">
                  <span className="block h-full rounded-pill bg-success-300" style={{ width: `${Math.min(100, k.porcentaje)}%` }} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
