"use client";

// Ficha de una medalla (2026-11-15; lienzo aprobado el mismo día; RF-GAM-46 a 49). Ventana <dialog> nativa, como
// FichaDeRango: Esc la cierra, el foco vuelve al botón que la abrió y el clic en el fondo la cierra. Las flechas pasan
// a la medalla anterior o siguiente, en el orden del catálogo, sin cerrar.
// Contenido: ilustración del nivel visible (sin nivel: la del nivel 1 en gris), valor de hoy y lo que falta, y la
// escalera de niveles: alcanzados a color con su fecha, el siguiente con contorno y avance, los demás en gris
// (decisión del 2026-11-15: los niveles futuros se ven, en gris). Textos en TEXTOS.medallas.

import { useEffect, useRef } from "react";
import { claseDeVentana } from "@/components/ui/ventana-emergente";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { imagenDeMedalla } from "@/lib/gamificacion/recursos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import type { MedallaEnPantalla } from "@/lib/gamificacion/medallas";

const T = TEXTOS.medallas;
const FECHA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, day: "numeric", month: "short", year: "numeric" });
const fecha = (iso: string) => FECHA.format(new Date(iso)).replace(/\./g, "");

const CLASE_DE_BOTON =
  "inline-flex h-10 w-10 items-center justify-center rounded-pill border border-white/30 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-200";

function Flecha({ trazo }: { trazo: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={trazo} />
    </svg>
  );
}

/** Etiqueta de estado de una medalla: «Arbusto · nivel 3 de 5», «Sin desbloquear» o «Nivel máximo · Bosque». */
export function estadoDeMedalla(m: MedallaEnPantalla): { texto: string; tono: "nueva" | "avance" | "maximo" } {
  const total = m.niveles.length;
  if (m.nivel === 0) return { texto: T.sinNivel, tono: "nueva" };
  const nombre = m.niveles[m.nivel - 1]?.nombre ?? "";
  if (m.nivel >= total) return { texto: T.nivelMaximo(nombre), tono: "maximo" };
  return { texto: T.nivelDe(nombre, m.nivel, total), tono: "avance" };
}

export const TONO_DE_ESTADO = {
  nueva: "bg-system-100 text-system-700",
  avance: "bg-success-50 text-success-800",
  maximo: "bg-warning-100 text-warning-800",
} as const;

/** Ilustración del nivel visible; sin nivel, la del nivel 1 (la tarjeta y la ficha la ponen en gris). */
export function imagenVisible(m: MedallaEnPantalla, lado: 128 | 256 | 640 = 256): string {
  const n = m.niveles[Math.max(0, m.nivel - 1)];
  return imagenDeMedalla(m.clave, n.nivel, n.nombre, lado, n.ilustracion);
}

export default function FichaDeMedalla({
  medallas,
  abierta,
  onIr,
  onCerrar,
}: {
  medallas: MedallaEnPantalla[];
  /** Clave de la medalla que se muestra; null con la ventana cerrada. */
  abierta: string | null;
  onIr: (clave: string) => void;
  onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const posicion = medallas.findIndex((m) => m.clave === abierta);
  const m = posicion >= 0 ? medallas[posicion] : null;
  const anterior = medallas.length > 1 && posicion >= 0 ? medallas[(posicion - 1 + medallas.length) % medallas.length] : null;
  const siguiente = medallas.length > 1 && posicion >= 0 ? medallas[(posicion + 1) % medallas.length] : null;

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (m && !d.open) d.showModal();
    if (!m && d.open) d.close();
  }, [m]);

  const estado = m ? estadoDeMedalla(m) : null;
  const proximo = m ? m.niveles[m.nivel] ?? null : null;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="ficha-medalla-titulo"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
      className={claseDeVentana("normal")}
    >
      {m && estado && (
        <div className="flex max-h-[88vh] flex-col">
          <div className="bg-brand-950 px-5 pt-4 pb-5 text-white md:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {anterior && (
                  <button type="button" onClick={() => onIr(anterior.clave)} aria-label={T.anterior(anterior.nombre)} className={CLASE_DE_BOTON}>
                    <Flecha trazo="M15 18l-6-6 6-6" />
                  </button>
                )}
                {siguiente && (
                  <button type="button" onClick={() => onIr(siguiente.clave)} aria-label={T.siguiente(siguiente.nombre)} className={CLASE_DE_BOTON}>
                    <Flecha trazo="M9 18l6-6-6-6" />
                  </button>
                )}
              </div>
              <span className="text-[12.5px] text-brand-200">{T.fichaPosicion(posicion + 1, medallas.length)}</span>
              <button type="button" onClick={() => dialogo.current?.close()} aria-label={T.cerrar} className={CLASE_DE_BOTON}>
                <Flecha trazo="M18 6L6 18M6 6l12 12" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4 md:gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en public/ */}
              <img
                src={imagenVisible(m)}
                alt=""
                width={128}
                height={128}
                className={`h-24 w-24 shrink-0 md:h-32 md:w-32 ${m.nivel === 0 ? "opacity-45 grayscale" : ""}`}
              />
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <span className={`rounded-[8px] px-2.5 py-0.5 text-[12.5px] font-bold ${TONO_DE_ESTADO[estado.tono]}`}>{estado.texto}</span>
                <h2 id="ficha-medalla-titulo" className="text-[22px] leading-tight font-extrabold md:text-[26px]">
                  {m.nombre}
                </h2>
                {m.queMide && <p className="text-[13.5px] text-brand-100">{m.queMide}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 md:px-6">
            <p className="flex flex-wrap items-baseline gap-x-2.5 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[13.5px] text-brand-800">
              <strong className="font-mono text-[22px] text-brand-950">{m.valor.toLocaleString("es-MX")}</strong>
              <span>{T.valorHoy(T.unidad(m.mide, m.valor), proximo ? proximo.umbral - m.valor : null, proximo?.nombre ?? null)}</span>
            </p>

            <section aria-labelledby="ficha-medalla-niveles">
              <h3 id="ficha-medalla-niveles" className="mb-1 text-sm font-extrabold text-system-900">
                {T.nivelesTitulo}
              </h3>
              <ol>
                {m.niveles.map((n) => {
                  const alcanzado = n.nivel <= m.nivel;
                  const esSiguiente = n.nivel === m.nivel + 1;
                  return (
                    <li key={n.nivel} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-t border-system-100 py-2">
                      <span className={`inline-flex rounded-pill ${esSiguiente ? "ring-2 ring-brand-200 ring-offset-2" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado en public/ */}
                        <img
                          src={imagenDeMedalla(m.clave, n.nivel, n.nombre, 128, n.ilustracion)}
                          alt=""
                          width={52}
                          height={52}
                          className={`h-13 w-13 ${alcanzado ? "" : esSiguiente ? "opacity-90" : "opacity-40 grayscale"}`}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <strong className="text-sm text-system-900">{n.nombre}</strong>
                        <span className="text-[12.5px] text-system-600">{T.meta(m.mide, n.umbral, T.unidad(m.mide, n.umbral))}</span>
                      </span>
                      <span
                        className={`text-right text-[12.5px] font-bold ${
                          alcanzado ? "text-success-800" : esSiguiente ? "font-mono text-system-900" : "text-system-500"
                        }`}
                      >
                        {alcanzado
                          ? n.alcanzadoEn
                            ? T.alcanzadoEl(fecha(n.alcanzadoEn))
                            : T.alcanzado
                          : esSiguiente
                            ? T.avance(m.valor, n.umbral)
                            : T.porAlcanzar}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            {m.mide && T.notas[m.mide] && (
              <p className="rounded-lg border border-system-100 bg-system-50 px-3.5 py-2.5 text-[13px] text-system-700">{T.notas[m.mide]}</p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
